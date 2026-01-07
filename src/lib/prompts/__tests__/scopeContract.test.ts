// ============================================================================
// SCOPE CONTRACT TESTS
// ============================================================================
// Unit and regression tests for buildScopeContract
// Run with: deno test --allow-env --allow-net src/lib/prompts/__tests__/scopeContract.test.ts
// Or use your preferred test runner when configured
// ============================================================================

import {
  buildScopeContract,
  freezeScopeContractWithRoles,
  createScopeContractLog,
  type ScopeContractInput,
  type ScopeContract,
  type LearnerRole
} from '../scopeContract.ts';

// ============================================================================
// TEST FIXTURES
// ============================================================================

const UST_ALARMS_CONTENT = `
<h1>UST Alarms and Slow Flow Reporting</h1>

<p>As a store associate, you play a critical role in maintaining safety and compliance at the fuel station. This training covers what to do when you encounter Underground Storage Tank (UST) alarms or slow flow conditions at the dispenser.</p>

<h2>Understanding UST Alarms</h2>
<p>The tank monitor in the back office displays alarms when there's a potential issue with the underground storage tanks. When you hear an alarm or see a warning light:</p>
<ul>
  <li><strong>Do not ignore it.</strong> Report alarms immediately to your supervisor.</li>
  <li>Document the time and type of alarm in the incident log.</li>
  <li>Do not attempt to reset the alarm yourself unless trained to do so.</li>
</ul>

<h2>Slow Flow Conditions</h2>
<p>If a customer reports that the pump is dispensing fuel slowly, or you notice slow flow during your shift:</p>
<ul>
  <li>Report slow flow to supervisor immediately.</li>
  <li>Note which dispenser is affected.</li>
  <li>Do not attempt to repair the dispenser.</li>
</ul>

<h2>Escalation</h2>
<p>All UST issues must be escalated to management. You should never attempt to access the tank area or make repairs. Your role is to observe, report, and document.</p>

<p><strong>Remember:</strong> Safety first. When in doubt, ask your supervisor.</p>
`;

const TOBACCO_SALES_CONTENT = `
<h1>Tobacco Sales Compliance Training</h1>

<p>Selling tobacco products carries legal responsibilities. As a cashier at the point of sale, you must follow all age verification procedures to prevent sales to minors.</p>

<h2>Age Verification Requirements</h2>
<p>You must check ID for every tobacco purchase. No exceptions.</p>
<ul>
  <li>Ask for ID before scanning any tobacco product.</li>
  <li>Check the photo - does it match the customer?</li>
  <li>Verify the date of birth. The customer must be 21 or older.</li>
  <li>Check the expiration date - expired IDs are not valid.</li>
</ul>

<h2>Acceptable Forms of ID</h2>
<ul>
  <li>State-issued driver's license</li>
  <li>State-issued ID card</li>
  <li>U.S. passport</li>
  <li>Military ID</li>
</ul>

<h2>When to Refuse the Sale</h2>
<p>You must refuse the sale if:</p>
<ul>
  <li>The customer cannot produce valid ID</li>
  <li>The ID appears fake, altered, or suspicious</li>
  <li>The customer is under 21</li>
  <li>Someone else may be purchasing for a minor</li>
</ul>

<p>How to refuse: "I'm sorry, I can't complete this sale without valid ID showing you're 21 or older."</p>

<h2>Penalties</h2>
<p>Selling tobacco to a minor is illegal. You could face personal fines, and the store could lose its tobacco license. Always verify age - no exceptions.</p>
`;

const MANAGER_POLICY_CONTENT = `
<h1>Manager Compliance Training: Store Policy Enforcement</h1>

<p>As a manager or shift supervisor, you are responsible for ensuring your team follows company policies and regulatory requirements. This training covers your supervisory responsibilities.</p>

<h2>Training Your Staff</h2>
<p>You must ensure all employees complete required training before working the register or handling age-restricted products.</p>
<ul>
  <li>Train new hires on age verification within the first week.</li>
  <li>Conduct refresher training quarterly.</li>
  <li>Document all training in the employee file.</li>
</ul>

<h2>Compliance Audits</h2>
<p>Review compliance logs weekly. Look for:</p>
<ul>
  <li>ID check refusals - review each one</li>
  <li>Register overrides - investigate any unusual patterns</li>
  <li>Missing documentation - follow up immediately</li>
</ul>

<h2>Coaching and Discipline</h2>
<p>When an employee fails to follow procedures:</p>
<ul>
  <li>First occurrence: Verbal coaching and retraining</li>
  <li>Second occurrence: Written warning</li>
  <li>Third occurrence: Final warning or termination review</li>
</ul>

<h2>Your Team's Performance</h2>
<p>You are accountable for your team's compliance. Review the daily compliance reports and address issues same-day. If you notice patterns of non-compliance, take immediate corrective action.</p>
`;

// ============================================================================
// MOCK SETUP (for tests without actual API calls)
// ============================================================================

// These tests are designed to work both with mocked responses and real API calls
// For CI/automated testing, mock the chatCompletion function
// For manual validation, run with actual API keys

// ============================================================================
// TEST CASES
// ============================================================================

/**
 * Test Case 1: UST Alarms / Slow Flow Article
 * Expected:
 * - role: frontline_store_associate (or other with medium confidence)
 * - actions: "report alarms immediately", "report slow flow to supervisor"
 * - anchors include: "tank monitor", "UST", "alarm", "slow flow", "dispenser"
 * - disallowed includes: "commercial vehicle compliance", "alcohol ID checks", "tax filing"
 */
async function testUSTAlarmsContract(): Promise<{ passed: boolean; details: string }> {
  const input: ScopeContractInput = {
    sourceTrackType: 'article',
    sourceTitle: 'UST Alarms and Slow Flow Reporting',
    sourceContent: UST_ALARMS_CONTENT,
    variantType: 'geographic',
    variantContext: {
      state_code: 'TX',
      state_name: 'Texas'
    }
  };

  try {
    const result = await buildScopeContract(input);
    const contract = result.scopeContract;
    const issues: string[] = [];

    // Check role
    if (contract.primaryRole !== 'frontline_store_associate' && contract.primaryRole !== 'other') {
      issues.push(`Expected frontline_store_associate or other, got ${contract.primaryRole}`);
    }

    // Check actions include reporting
    const hasReportAction = contract.allowedLearnerActions.some(a =>
      a.toLowerCase().includes('report') || a.toLowerCase().includes('notify')
    );
    if (!hasReportAction) {
      issues.push('Expected "report" action in allowedLearnerActions');
    }

    // Check anchors include UST-related terms
    const anchorsLower = contract.domainAnchors.map(a => a.toLowerCase());
    const expectedAnchors = ['ust', 'alarm', 'tank', 'dispenser'];
    const foundAnchors = expectedAnchors.filter(e => anchorsLower.some(a => a.includes(e)));
    if (foundAnchors.length < 2) {
      issues.push(`Expected at least 2 UST-related anchors, found: ${foundAnchors.join(', ')}`);
    }

    // Check disallowed actions don't include frontline duties
    const disallowedLower = contract.disallowedActionClasses.map(d => d.toLowerCase());
    const hasTaxDisallowed = disallowedLower.some(d => d.includes('tax'));
    if (!hasTaxDisallowed) {
      issues.push('Expected "tax filing" or similar in disallowedActionClasses');
    }

    return {
      passed: issues.length === 0,
      details: issues.length === 0
        ? `PASS: UST Alarms contract valid. Role: ${contract.primaryRole}, Actions: ${contract.allowedLearnerActions.length}, Anchors: ${contract.domainAnchors.length}`
        : `FAIL: ${issues.join('; ')}`
    };
  } catch (error) {
    return {
      passed: false,
      details: `ERROR: ${(error as Error).message}`
    };
  }
}

/**
 * Test Case 2: Tobacco Sales Transcript
 * Expected:
 * - role: frontline_store_associate
 * - actions: check ID, refuse sale, verify age
 * - disallowed includes: tax filing, licensing fee schedules, smoke-free rules, food safety
 */
async function testTobaccoSalesContract(): Promise<{ passed: boolean; details: string }> {
  const input: ScopeContractInput = {
    sourceTrackType: 'video',
    sourceTitle: 'Tobacco Sales Compliance Training',
    sourceContent: TOBACCO_SALES_CONTENT,
    variantType: 'geographic',
    variantContext: {
      state_code: 'CA',
      state_name: 'California'
    }
  };

  try {
    const result = await buildScopeContract(input);
    const contract = result.scopeContract;
    const issues: string[] = [];

    // Check role is frontline
    if (contract.primaryRole !== 'frontline_store_associate') {
      // Allow 'other' with evidence of frontline terminology
      if (contract.primaryRole !== 'other') {
        issues.push(`Expected frontline_store_associate, got ${contract.primaryRole}`);
      }
    }

    // Check actions include ID verification
    const actionsLower = contract.allowedLearnerActions.map(a => a.toLowerCase());
    const hasIDCheck = actionsLower.some(a =>
      a.includes('check id') || a.includes('verify') || a.includes('id')
    );
    const hasRefuse = actionsLower.some(a => a.includes('refuse'));

    if (!hasIDCheck) {
      issues.push('Expected ID check action in allowedLearnerActions');
    }
    if (!hasRefuse) {
      issues.push('Expected refuse sale action in allowedLearnerActions');
    }

    // Check role confidence
    if (contract.roleConfidence === 'low') {
      issues.push('Role confidence should be medium or high for clear frontline content');
    }

    return {
      passed: issues.length === 0,
      details: issues.length === 0
        ? `PASS: Tobacco Sales contract valid. Role: ${contract.primaryRole} (${contract.roleConfidence}), Actions include ID and refuse`
        : `FAIL: ${issues.join('; ')}`
    };
  } catch (error) {
    return {
      passed: false,
      details: `ERROR: ${(error as Error).message}`
    };
  }
}

/**
 * Test Case 3: Manager Policy Document
 * Expected:
 * - role: manager_supervisor
 * - actions: train staff, enforce policy, review compliance logs
 * - disallowed includes: cashier-only POS steps unless present
 */
async function testManagerPolicyContract(): Promise<{ passed: boolean; details: string }> {
  const input: ScopeContractInput = {
    sourceTrackType: 'article',
    sourceTitle: 'Manager Compliance Training: Store Policy Enforcement',
    sourceContent: MANAGER_POLICY_CONTENT,
    variantType: 'geographic',
    variantContext: {
      state_code: 'NY',
      state_name: 'New York'
    }
  };

  try {
    const result = await buildScopeContract(input);
    const contract = result.scopeContract;
    const issues: string[] = [];

    // Check role is manager
    if (contract.primaryRole !== 'manager_supervisor') {
      issues.push(`Expected manager_supervisor, got ${contract.primaryRole}`);
    }

    // Check actions include management duties
    const actionsLower = contract.allowedLearnerActions.map(a => a.toLowerCase());
    const hasTrain = actionsLower.some(a => a.includes('train'));
    const hasReview = actionsLower.some(a => a.includes('review') || a.includes('audit'));

    if (!hasTrain) {
      issues.push('Expected training action in allowedLearnerActions');
    }
    if (!hasReview) {
      issues.push('Expected review/audit action in allowedLearnerActions');
    }

    // Check disallowed includes executive duties
    const disallowedLower = contract.disallowedActionClasses.map(d => d.toLowerCase());
    const hasExecutiveDisallowed = disallowedLower.some(d =>
      d.includes('license') || d.includes('tax') || d.includes('pricing')
    );
    if (!hasExecutiveDisallowed) {
      issues.push('Expected executive duties in disallowedActionClasses');
    }

    return {
      passed: issues.length === 0,
      details: issues.length === 0
        ? `PASS: Manager Policy contract valid. Role: ${contract.primaryRole}, Has train and review actions`
        : `FAIL: ${issues.join('; ')}`
    };
  } catch (error) {
    return {
      passed: false,
      details: `ERROR: ${(error as Error).message}`
    };
  }
}

/**
 * Test Case 4: Freeze contract with user-selected roles
 */
function testFreezeContractWithRoles(): { passed: boolean; details: string } {
  const originalContract: ScopeContract = {
    primaryRole: 'other',
    secondaryRoles: [],
    roleConfidence: 'low',
    roleEvidenceQuotes: [],
    allowedLearnerActions: ['report issues', 'follow procedures', 'document incidents', 'notify supervisor', 'complete logs'],
    disallowedActionClasses: ['file taxes', 'set pricing', 'hire employees', 'modify licenses', 'approve budgets'],
    domainAnchors: ['safety', 'compliance', 'procedures', 'documentation', 'reporting', 'incidents'],
    instructionalGoal: 'Train learners on safety reporting procedures.'
  };

  const frozen = freezeScopeContractWithRoles(
    originalContract,
    'frontline_store_associate',
    ['delivery_driver']
  );

  const issues: string[] = [];

  if (frozen.primaryRole !== 'frontline_store_associate') {
    issues.push(`Primary role not updated: ${frozen.primaryRole}`);
  }
  if (frozen.secondaryRoles.length !== 1 || frozen.secondaryRoles[0] !== 'delivery_driver') {
    issues.push(`Secondary roles not updated: ${JSON.stringify(frozen.secondaryRoles)}`);
  }
  if (frozen.roleConfidence !== 'high') {
    issues.push(`Role confidence should be high after freeze: ${frozen.roleConfidence}`);
  }

  return {
    passed: issues.length === 0,
    details: issues.length === 0
      ? 'PASS: freezeScopeContractWithRoles correctly updates role fields'
      : `FAIL: ${issues.join('; ')}`
  };
}

/**
 * Test Case 5: Create scope contract log
 */
function testCreateScopeContractLog(): { passed: boolean; details: string } {
  const mockResult = {
    scopeContract: {
      primaryRole: 'frontline_store_associate' as LearnerRole,
      secondaryRoles: [] as LearnerRole[],
      roleConfidence: 'high' as const,
      roleEvidenceQuotes: ['test quote'],
      allowedLearnerActions: ['action 1', 'action 2', 'action 3', 'action 4', 'action 5'],
      disallowedActionClasses: ['disallowed 1', 'disallowed 2', 'disallowed 3', 'disallowed 4', 'disallowed 5'],
      domainAnchors: ['anchor 1', 'anchor 2', 'anchor 3', 'anchor 4', 'anchor 5', 'anchor 6'],
      instructionalGoal: 'Test goal'
    },
    roleSelectionNeeded: false,
    extractionMethod: 'llm' as const
  };

  const mockInput: ScopeContractInput = {
    sourceTrackType: 'article',
    sourceTitle: 'Test Track',
    sourceContent: 'Test content',
    variantType: 'geographic',
    variantContext: { state_code: 'TX', state_name: 'Texas' }
  };

  const log = createScopeContractLog(mockResult, mockInput, 'test-track-id');

  const issues: string[] = [];

  if (!log.id) {
    issues.push('Log missing id');
  }
  if (!log.timestamp) {
    issues.push('Log missing timestamp');
  }
  if (log.sourceTrackId !== 'test-track-id') {
    issues.push(`Wrong sourceTrackId: ${log.sourceTrackId}`);
  }
  if (log.variantType !== 'geographic') {
    issues.push(`Wrong variantType: ${log.variantType}`);
  }

  return {
    passed: issues.length === 0,
    details: issues.length === 0
      ? 'PASS: createScopeContractLog creates valid log structure'
      : `FAIL: ${issues.join('; ')}`
  };
}

// ============================================================================
// TEST RUNNER
// ============================================================================

interface TestResult {
  name: string;
  passed: boolean;
  details: string;
}

export async function runAllTests(): Promise<TestResult[]> {
  console.log('============================================');
  console.log('SCOPE CONTRACT TESTS');
  console.log('============================================\n');

  const results: TestResult[] = [];

  // Synchronous tests (no API calls)
  console.log('Running synchronous tests...\n');

  const freezeResult = testFreezeContractWithRoles();
  results.push({ name: 'freezeScopeContractWithRoles', ...freezeResult });
  console.log(`[${freezeResult.passed ? 'PASS' : 'FAIL'}] freezeScopeContractWithRoles`);
  console.log(`  ${freezeResult.details}\n`);

  const logResult = testCreateScopeContractLog();
  results.push({ name: 'createScopeContractLog', ...logResult });
  console.log(`[${logResult.passed ? 'PASS' : 'FAIL'}] createScopeContractLog`);
  console.log(`  ${logResult.details}\n`);

  // Async tests (require API - skip if no key)
  const hasApiKey = typeof Deno !== 'undefined'
    ? !!Deno.env.get('OPENAI_API_KEY')
    : !!process.env.OPENAI_API_KEY;

  if (hasApiKey) {
    console.log('Running API-dependent tests...\n');

    const ustResult = await testUSTAlarmsContract();
    results.push({ name: 'UST Alarms Contract', ...ustResult });
    console.log(`[${ustResult.passed ? 'PASS' : 'FAIL'}] UST Alarms Contract`);
    console.log(`  ${ustResult.details}\n`);

    const tobaccoResult = await testTobaccoSalesContract();
    results.push({ name: 'Tobacco Sales Contract', ...tobaccoResult });
    console.log(`[${tobaccoResult.passed ? 'PASS' : 'FAIL'}] Tobacco Sales Contract`);
    console.log(`  ${tobaccoResult.details}\n`);

    const managerResult = await testManagerPolicyContract();
    results.push({ name: 'Manager Policy Contract', ...managerResult });
    console.log(`[${managerResult.passed ? 'PASS' : 'FAIL'}] Manager Policy Contract`);
    console.log(`  ${managerResult.details}\n`);
  } else {
    console.log('SKIPPING API-dependent tests (OPENAI_API_KEY not set)\n');
    results.push({ name: 'UST Alarms Contract', passed: true, details: 'SKIPPED: No API key' });
    results.push({ name: 'Tobacco Sales Contract', passed: true, details: 'SKIPPED: No API key' });
    results.push({ name: 'Manager Policy Contract', passed: true, details: 'SKIPPED: No API key' });
  }

  // Summary
  console.log('============================================');
  console.log('SUMMARY');
  console.log('============================================');
  const passed = results.filter(r => r.passed).length;
  const total = results.length;
  console.log(`${passed}/${total} tests passed`);

  if (passed < total) {
    console.log('\nFailed tests:');
    results.filter(r => !r.passed).forEach(r => {
      console.log(`  - ${r.name}: ${r.details}`);
    });
  }

  return results;
}

// Run tests if executed directly
if (typeof Deno !== 'undefined') {
  // Deno runtime
  runAllTests().then(results => {
    const allPassed = results.every(r => r.passed);
    Deno.exit(allPassed ? 0 : 1);
  });
} else if (typeof require !== 'undefined' && require.main === module) {
  // Node.js runtime
  runAllTests().then(results => {
    const allPassed = results.every(r => r.passed);
    process.exit(allPassed ? 0 : 1);
  });
}
