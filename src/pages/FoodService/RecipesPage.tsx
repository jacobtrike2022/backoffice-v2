/**
 * Recipes Page - Main view for recipe management
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Card,
  CardContent,
  CardMedia,
  CardActions,
  Grid,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Button,
  IconButton,
  Typography,
  Chip,
  InputAdornment,
  CircularProgress,
  Alert,
  Pagination,
  Container,
} from '@mui/material';
import {
  Search as SearchIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
  Restaurant as RestaurantIcon,
} from '@mui/icons-material';
import { getRecipes, deleteRecipe } from '../../lib/crud/recipes';
import { getCurrentUserOrgId } from '../../lib/supabase';
import type { Recipe, RecipeFilters } from '../../types/recipes';

export function RecipesPage() {
  const navigate = useNavigate();
  const [organizationId, setOrganizationId] = useState<string>('');
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [daypartFilter, setDaypartFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  // Pagination
  const [page, setPage] = useState(1);
  const itemsPerPage = 12;

  useEffect(() => {
    initializeOrg();
  }, []);

  useEffect(() => {
    if (organizationId) {
      loadRecipes();
    }
  }, [organizationId, searchQuery, categoryFilter, daypartFilter, statusFilter]);

  async function initializeOrg() {
    try {
      const orgId = await getCurrentUserOrgId();
      if (!orgId) throw new Error('No organization found');
      setOrganizationId(orgId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load organization');
      setLoading(false);
    }
  }

  async function loadRecipes() {
    setLoading(true);
    setError(null);

    try {
      const filters: RecipeFilters = {};
      if (searchQuery) filters.search = searchQuery;
      if (categoryFilter !== 'all') filters.category = categoryFilter;
      if (daypartFilter !== 'all') filters.daypart = daypartFilter;
      if (statusFilter !== 'all') filters.status = statusFilter as 'active' | 'draft' | 'archived';

      const response = await getRecipes(organizationId, filters, 1, 100); // Get first 100 recipes
      setRecipes(response.data);
      setPage(1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load recipes');
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(recipeId: string, recipeName: string) {
    if (!confirm(`Are you sure you want to delete "${recipeName}"?`)) return;

    try {
      await deleteRecipe(recipeId);
      await loadRecipes();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete recipe');
    }
  }

  const getStatusColor = (status: string): 'success' | 'default' | 'warning' => {
    if (status === 'active') return 'success';
    if (status === 'draft') return 'warning';
    return 'default';
  };

  const paginatedRecipes = recipes.slice((page - 1) * itemsPerPage, page * itemsPerPage);
  const totalPages = Math.ceil(recipes.length / itemsPerPage);

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1">
          Recipes
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => navigate('/recipes/new')}
        >
          Create Recipe
        </Button>
      </Box>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={2}>
            <Grid item xs={12} md={3}>
              <TextField
                fullWidth
                size="small"
                placeholder="Search recipes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon />
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel>Category</InputLabel>
                <Select
                  value={categoryFilter}
                  label="Category"
                  onChange={(e) => setCategoryFilter(e.target.value)}
                >
                  <MenuItem value="all">All Categories</MenuItem>
                  <MenuItem value="hot-food">Hot Food</MenuItem>
                  <MenuItem value="cold-food">Cold Food</MenuItem>
                  <MenuItem value="beverage">Beverage</MenuItem>
                  <MenuItem value="snack">Snack</MenuItem>
                  <MenuItem value="bakery">Bakery</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel>Daypart</InputLabel>
                <Select
                  value={daypartFilter}
                  label="Daypart"
                  onChange={(e) => setDaypartFilter(e.target.value)}
                >
                  <MenuItem value="all">All Dayparts</MenuItem>
                  <MenuItem value="breakfast">Breakfast</MenuItem>
                  <MenuItem value="lunch">Lunch</MenuItem>
                  <MenuItem value="dinner">Dinner</MenuItem>
                  <MenuItem value="all-day">All Day</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel>Status</InputLabel>
                <Select
                  value={statusFilter}
                  label="Status"
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <MenuItem value="all">All Status</MenuItem>
                  <MenuItem value="active">Active</MenuItem>
                  <MenuItem value="draft">Draft</MenuItem>
                  <MenuItem value="archived">Archived</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {!loading && !error && recipes.length === 0 && (
        <Card>
          <CardContent sx={{ textAlign: 'center', py: 8 }}>
            <RestaurantIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" gutterBottom>
              No recipes found
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Create your first recipe to start tracking food costs
            </Typography>
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => navigate('/recipes/new')}>
              Create Recipe
            </Button>
          </CardContent>
        </Card>
      )}

      {!loading && !error && paginatedRecipes.length > 0 && (
        <>
          <Grid container spacing={3}>
            {paginatedRecipes.map((recipe) => (
              <Grid item xs={12} sm={6} md={4} lg={3} key={recipe.id}>
                <Card
                  sx={{
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    transition: 'box-shadow 0.3s',
                    '&:hover': { boxShadow: 6 },
                    cursor: 'pointer',
                  }}
                  onClick={() => navigate(`/recipes/${recipe.id}`)}
                >
                  {recipe.image_url ? (
                    <CardMedia
                      component="img"
                      height="160"
                      image={recipe.image_url}
                      alt={recipe.name}
                    />
                  ) : (
                    <Box
                      sx={{
                        height: 160,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        bgcolor: 'grey.200',
                      }}
                    >
                      <RestaurantIcon sx={{ fontSize: 48, color: 'grey.400' }} />
                    </Box>
                  )}
                  <CardContent sx={{ flexGrow: 1 }}>
                    <Typography variant="h6" component="h3" gutterBottom noWrap>
                      {recipe.name}
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
                      <Chip label={recipe.category} size="small" />
                      {recipe.daypart && <Chip label={recipe.daypart} size="small" variant="outlined" />}
                      <Chip
                        label={recipe.status}
                        size="small"
                        color={getStatusColor(recipe.status)}
                      />
                    </Box>
                    <Typography variant="body2" color="text.secondary">
                      Yield: {recipe.yield_quantity} {recipe.yield_unit}
                    </Typography>
                    {recipe.current_retail_price && (
                      <Typography variant="body2" color="text.secondary">
                        Price: ${recipe.current_retail_price.toFixed(2)}
                      </Typography>
                    )}
                  </CardContent>
                  <CardActions sx={{ justifyContent: 'flex-end', px: 2, pb: 2 }}>
                    <IconButton
                      size="small"
                      color="primary"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/recipes/${recipe.id}/edit`);
                      }}
                    >
                      <EditIcon />
                    </IconButton>
                    <IconButton
                      size="small"
                      color="error"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(recipe.id, recipe.name);
                      }}
                    >
                      <DeleteIcon />
                    </IconButton>
                  </CardActions>
                </Card>
              </Grid>
            ))}
          </Grid>

          {totalPages > 1 && (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
              <Pagination
                count={totalPages}
                page={page}
                onChange={(_, value) => setPage(value)}
                color="primary"
              />
            </Box>
          )}
        </>
      )}

      {!loading && !error && recipes.length > 0 && (
        <Box sx={{ mt: 3, textAlign: 'center' }}>
          <Typography variant="body2" color="text.secondary">
            Showing {paginatedRecipes.length} of {recipes.length} recipe{recipes.length !== 1 ? 's' : ''}
          </Typography>
        </Box>
      )}
    </Container>
  );
}
