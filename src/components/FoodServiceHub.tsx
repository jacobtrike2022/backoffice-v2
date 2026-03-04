/**
 * Food Service Hub - Main navigation for all food service features
 * Uses MUI Tabs to switch between Recipes, Ingredients, Invoices, Waste Tracking
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Tabs,
  Tab,
  Typography,
  Alert,
  CircularProgress,
} from '@mui/material';
import {
  Restaurant as RestaurantIcon,
  Inventory2 as InventoryIcon,
  Receipt as ReceiptIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import { getCurrentUserOrgId } from '../lib/supabase';
import { RecipesPage } from '../pages/FoodService/RecipesPage';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`food-service-tabpanel-${index}`}
      aria-labelledby={`food-service-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
    </div>
  );
}

export function FoodServiceHub() {
  const [tabValue, setTabValue] = useState(0);
  const [organizationId, setOrganizationId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    initializeOrg();
  }, []);

  async function initializeOrg() {
    try {
      const orgId = await getCurrentUserOrgId();
      if (!orgId) throw new Error('No organization found');
      setOrganizationId(orgId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load organization');
    } finally {
      setLoading(false);
    }
  }

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  if (loading) {
    return (
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  if (error) {
    return (
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Alert severity="error">{error}</Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        Food Service Management
      </Typography>
      <Typography variant="body2" color="text.secondary" paragraph>
        Manage recipes, track costs, process invoices, and monitor waste
      </Typography>

      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={tabValue} onChange={handleTabChange} aria-label="food service tabs">
          <Tab
            icon={<RestaurantIcon />}
            iconPosition="start"
            label="Recipes"
            id="food-service-tab-0"
            aria-controls="food-service-tabpanel-0"
          />
          <Tab
            icon={<InventoryIcon />}
            iconPosition="start"
            label="Ingredients"
            id="food-service-tab-1"
            aria-controls="food-service-tabpanel-1"
          />
          <Tab
            icon={<ReceiptIcon />}
            iconPosition="start"
            label="Invoices"
            id="food-service-tab-2"
            aria-controls="food-service-tabpanel-2"
          />
          <Tab
            icon={<DeleteIcon />}
            iconPosition="start"
            label="Waste Tracking"
            id="food-service-tab-3"
            aria-controls="food-service-tabpanel-3"
          />
        </Tabs>
      </Box>

      <TabPanel value={tabValue} index={0}>
        <RecipesPage />
      </TabPanel>

      <TabPanel value={tabValue} index={1}>
        <Box>
          <Typography variant="h6" gutterBottom>
            Ingredients Module (Coming Soon)
          </Typography>
          <Alert severity="info">
            The ingredients management module is under development.
          </Alert>
        </Box>
      </TabPanel>

      <TabPanel value={tabValue} index={2}>
        <Box>
          <Typography variant="h6" gutterBottom>
            Invoices Module (Coming Soon)
          </Typography>
          <Alert severity="info">
            The invoice processing module is under development.
          </Alert>
        </Box>
      </TabPanel>

      <TabPanel value={tabValue} index={3}>
        <Box>
          <Typography variant="h6" gutterBottom>
            Waste Tracking Module (Coming Soon)
          </Typography>
          <Alert severity="info">
            The waste tracking module is under development.
          </Alert>
        </Box>
      </TabPanel>
    </Container>
  );
}
