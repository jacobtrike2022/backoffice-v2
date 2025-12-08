import { Hono } from 'npm:hono';
import { createClient } from 'npm:@supabase/supabase-js@2';

const checkpointAIApp = new Hono();

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

// Helper: Strip markdown/HTML from text
function stripMarkdown(text: string): string {
  return text
    .replace(/!\[.*?\]\(.*?\)/g, '') // Remove images
    .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1') // Convert links to text
    .replace(/[#*_~`]/g, '') // Remove markdown symbols
    .replace(/<[^>]+>/g, '') // Remove HTML tags
    .replace(/\n+/g, ' ') // Replace newlines with spaces
    .trim();
}

// Helper: Calculate optimal question count based on facts
function calculateQuestionCount(factCount: number): number {
  if (factCount === 1) return 1;
  if (factCount === 2) return 2;
  if (factCount <= 5) return 3;
  if (factCount <= 10) return 5;
  if (factCount <= 15) return 8;
  if (factCount <= 20) return 10;
  if (factCount <= 30) return 12;
  return 15; // Max cap
}

// Helper: Validate generated questions
interface ValidationResult {
  valid: boolean;
  errors: string[];
}

function validateQuestions(questions: any[], expectedCount: number): ValidationResult {
  const errors: string[] = [];
  
  // Check we have the expected number of questions (allow some flexibility)
  if (questions.length < Math.min(expectedCount, 1)) {
    errors.push('Must generate at least 1 question');
  }
  
  // For 1-2 questions, skip distribution checks (not enough data)
  if (questions.length >= 3) {
    // Check correct answer distribution for multiple choice - only flag if REALLY bad
    const mcQuestions = questions.filter(q => q.type === 'multiple_choice');
    if (mcQuestions.length >= 5) { // Only check if we have at least 5 MC questions
      const correctPositions = mcQuestions.map(q => 
        q.answers.findIndex((a: any) => a.is_correct)
      );
      
      const positionCounts: Record<number, number> = correctPositions.reduce((acc, pos) => {
        acc[pos] = (acc[pos] || 0) + 1;
        return acc;
      }, {} as Record<number, number>);
      
      const maxPosition = Math.max(...Object.values(positionCounts));
      
      // Only flag if more than 80% of answers are in the same position (very suspicious)
      // This prevents obvious patterns like all "A" but allows natural clustering
      if (maxPosition > mcQuestions.length * 0.8) {
        errors.push('Correct answers are not distributed evenly across positions');
      }
    }
  }
  
  // Check for duplicate questions
  const questionTexts = questions.map(q => q.question.toLowerCase().trim());
  const uniqueTexts = new Set(questionTexts);
  if (questionTexts.length !== uniqueTexts.size) {
    errors.push('Duplicate questions detected');
  }
  
  // Check all questions have correct answer marked
  questions.forEach((q, i) => {
    const hasCorrect = q.answers.some((a: any) => a.is_correct);
    if (!hasCorrect) {
      errors.push(`Question ${i + 1} has no correct answer marked`);
    }
    
    // Check multiple choice has exactly 4 options
    if (q.type === 'multiple_choice' && q.answers.length !== 4) {
      errors.push(`Question ${i + 1}: Multiple choice must have exactly 4 options`);
    }
    
    // Check true/false has exactly 2 options
    if (q.type === 'true_false' && q.answers.length !== 2) {
      errors.push(`Question ${i + 1}: True/false must have exactly 2 options`);
    }
  });
  
  return {
    valid: errors.length === 0,
    errors
  };
}

// POST /checkpoints/ai-generate - Generate checkpoint questions from article
checkpointAIApp.post('/ai-generate', async (c) => {
  try {
    const { trackId } = await c.req.json();
    
    if (!trackId) {
      return c.json({ error: 'trackId is required' }, 400);
    }
    
    console.log('🎯 Checkpoint AI generation requested for track:', trackId);
    
    // 1. Fetch track
    const { data: track, error: trackError } = await supabase
      .from('tracks')
      .select('*')
      .eq('id', trackId)
      .single();
    
    if (trackError || !track) {
      console.error('Track not found:', trackError);
      return c.json({ error: 'Track not found' }, 404);
    }
    
    if (track.type !== 'article') {
      return c.json({ error: 'Only articles are supported for AI generation' }, 400);
    }
    
    // 2. Check minimum content (lowered threshold)
    const articleContent = track.transcript || track.description || '';
    const wordCount = stripMarkdown(articleContent).split(/\s+/).filter(w => w.length > 0).length;
    
    console.log('📊 Article validation:', {
      trackId,
      trackTitle: track.title,
      wordCount,
      minRequired: 150
    });
    
    if (wordCount < 150) {
      return c.json({ 
        error: `Article too short (${wordCount} words). Need at least 150 words to generate meaningful questions.`
      }, 400);
    }
    
    // 3. Fetch key facts via fact_usage junction table
    console.log('🔍 Attempting to fetch facts for trackId:', trackId);
    
    const { data: factUsage, error: factsError } = await supabase
      .from('fact_usage')
      .select(`
        display_order,
        facts (
          id,
          title,
          content,
          type,
          steps,
          context
        )
      `)
      .eq('track_type', 'article')
      .eq('track_id', trackId)
      .order('display_order', { ascending: true }); // Order by display_order to preserve article flow
    
    // Extract facts from the joined data
    const facts = factUsage?.map(fu => fu.facts).filter(Boolean) || [];
    
    console.log('📊 Facts query result:', {
      trackId,
      factUsageCount: factUsage?.length || 0,
      factsFound: facts?.length || 0,
      hasError: !!factsError,
      error: factsError,
      sampleFact: facts?.[0] ? {
        id: facts[0].id,
        title: facts[0].title,
        content: facts[0].content?.substring(0, 50) + '...'
      } : null
    });
    
    if (factsError) {
      console.error('❌ Error fetching facts:', factsError);
      return c.json({ error: 'Failed to fetch key facts from database' }, 500);
    }
    
    // Handle no facts - helpful error message
    if (!facts || facts.length === 0) {
      console.warn('⚠️ No facts found for track:', trackId);
      return c.json({ 
        error: 'No key facts found for this article. Please go to the article detail page and click "Generate Key Facts" first, then try again.',
        needsFactExtraction: true
      }, 400);
    }
    
    console.log(`✅ Found ${facts.length} facts - proceeding with generation`);
    
    // 4. Calculate question count
    const questionCount = calculateQuestionCount(facts.length);
    console.log('🎲 Will generate', questionCount, 'questions');
    
    // 5. Call GPT-4o
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      console.error('OPENAI_API_KEY not configured');
      return c.json({ error: 'AI service not configured' }, 500);
    }
    
    const systemPrompt = `You are an expert training content developer for convenience store and foodservice operations. Your job is to create practical, job-relevant assessment questions.

RULES:
1. Generate exactly ${questionCount} questions
2. Mix 75% multiple choice (4 options each) and 25% true/false
3. Base questions on the provided key facts, prioritizing the most operationally important ones
4. Questions should follow the order facts appear in the article
5. Focus on practical application, not trivia or memorization
6. Difficulty: Medium (not too easy, not obscure)
7. Multiple choice correct answers should be distributed randomly across A/B/C/D (avoid patterns)
8. Distractors must be plausible but clearly incorrect
9. Never use "all of the above" or "none of the above"
10. True/false questions should not be obvious
11. Each question must be self-contained (no pronouns referring to previous questions)
12. Include an optional brief explanation for each question (1-2 sentences explaining why the answer is correct)

CONTEXT:
This checkpoint will be used to verify employees understand critical concepts for their job. Questions should be practical and directly applicable to their daily work.

FORMAT:
Return JSON only, no markdown:
{
  "questions": [
    {
      "question": "Question text here?",
      "type": "multiple_choice",
      "answers": [
        { "text": "Answer A", "is_correct": false },
        { "text": "Answer B", "is_correct": true },
        { "text": "Answer C", "is_correct": false },
        { "text": "Answer D", "is_correct": false }
      ],
      "explanation": "Brief explanation why B is correct"
    },
    {
      "question": "Statement for true/false",
      "type": "true_false",
      "answers": [
        { "text": "True", "is_correct": false },
        { "text": "False", "is_correct": true }
      ],
      "explanation": "Brief explanation"
    }
  ]
}`;

    const userPrompt = `ARTICLE TITLE: ${track.title}

KEY FACTS (in order of appearance):
${facts.map((f: any, i: number) => `${i + 1}. ${f.title}: ${f.content}`).join('\n')}

FULL ARTICLE CONTENT (for context):
${stripMarkdown(articleContent).substring(0, 3000)}${articleContent.length > 3000 ? '...' : ''}

Generate ${questionCount} questions that test understanding of the most important concepts for job performance.`;

    console.log('🤖 Calling GPT-4o...');
    
    let attempts = 0;
    let generatedQuestions: any[] = [];
    let validationResult: ValidationResult = { valid: false, errors: [] };
    
    // Try up to 2 times if validation fails
    while (attempts < 2 && !validationResult.valid) {
      attempts++;
      console.log(`🔄 Attempt ${attempts}/2`);
      
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          response_format: { type: 'json_object' },
          temperature: 0.7
        })
      });
      
      if (!response.ok) {
        const errorData = await response.text();
        console.error('OpenAI API error:', errorData);
        throw new Error('Failed to generate questions from AI service');
      }
      
      const data = await response.json();
      const content = data.choices[0]?.message?.content;
      
      if (!content) {
        throw new Error('No content returned from AI service');
      }
      
      try {
        const parsed = JSON.parse(content);
        generatedQuestions = parsed.questions || [];
        
        // Validate
        validationResult = validateQuestions(generatedQuestions, questionCount);
        
        if (!validationResult.valid) {
          console.warn('⚠️ Validation failed:', validationResult.errors);
          if (attempts < 2) {
            console.log('🔄 Retrying generation...');
          }
        } else {
          console.log('✅ Validation passed!');
        }
        
      } catch (parseError) {
        console.error('Failed to parse AI response:', parseError);
        if (attempts >= 2) {
          throw new Error('Failed to parse AI response after multiple attempts');
        }
      }
    }
    
    // If still invalid after retries, return error
    if (!validationResult.valid) {
      console.error('❌ Generation failed validation after 2 attempts:', validationResult.errors);
      return c.json({ 
        error: 'Failed to generate valid questions. Please try again.',
        validationErrors: validationResult.errors
      }, 500);
    }
    
    console.log(`✅ Successfully generated ${generatedQuestions.length} questions`);
    
    // Transform to checkpoint format with unique IDs
    const formattedQuestions = generatedQuestions.map((q: any, qIndex: number) => ({
      id: `ai-${Date.now()}-${qIndex}`,
      question: q.question,
      type: q.type,
      answers: q.answers.map((a: any, aIndex: number) => ({
        id: `ai-${Date.now()}-${qIndex}-${aIndex}`,
        text: a.text,
        isCorrect: a.is_correct
      })),
      explanation: q.explanation || undefined
    }));
    
    return c.json({ 
      questions: formattedQuestions,
      sourceTrackId: trackId,
      sourceTrackTitle: track.title,
      factCount: facts.length,
      questionCount: formattedQuestions.length,
      metadata: {
        suggestedTitle: `${track.title} - Checkpoint`,
        suggestedDescription: `Assessment questions generated from "${track.title}" to verify understanding of key concepts.`
      }
    });
    
  } catch (error: any) {
    console.error('❌ Error generating checkpoint questions:', error);
    return c.json({ 
      error: error.message || 'Failed to generate questions' 
    }, 500);
  }
});

export default checkpointAIApp;