import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';

interface ROICalculatorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Optional: pre-fill from deal/proposal data */
  defaults?: {
    locationCount?: number;
    perLocationRate?: number;
    perHireRate?: number;
  };
}

const TRIKE_TRAINING_HOURS = 1.5;
const DEFAULT_PER_LOCATION_RATE = 99;
const DEFAULT_PER_HIRE_RATE = 22;

export function ROICalculator({ open, onOpenChange, defaults }: ROICalculatorProps) {
  const [inputs, setInputs] = useState({
    locations: defaults?.locationCount || 10,
    employeesPerLocation: 15,
    turnoverRate: 75,
    hourlyWage: 15,
    currentTrainingHours: 40,
    currentPlatformCost: 0,
  });

  const perLocationRate = defaults?.perLocationRate || DEFAULT_PER_LOCATION_RATE;
  const perHireRate = defaults?.perHireRate || DEFAULT_PER_HIRE_RATE;

  const results = useMemo(() => {
    const totalEmployees = inputs.locations * inputs.employeesPerLocation;
    const annualNewHires = Math.round(totalEmployees * (inputs.turnoverRate / 100));

    // Current costs
    const currentTrainingLabor = annualNewHires * inputs.currentTrainingHours * inputs.hourlyWage;
    const currentTotalCost = currentTrainingLabor + inputs.currentPlatformCost;

    // Trike costs
    const trikeSubscription = inputs.locations * perLocationRate * 12;
    const trikePerHireCost = annualNewHires * perHireRate;
    const trikeTrainingLabor = annualNewHires * TRIKE_TRAINING_HOURS * inputs.hourlyWage;
    const trikeTotalCost = trikeSubscription + trikePerHireCost + trikeTrainingLabor;

    // Savings
    const annualSavings = currentTotalCost - trikeTotalCost;
    const roiPercent = trikeTotalCost > 0 ? ((annualSavings / trikeTotalCost) * 100) : 0;
    const hoursRecovered = annualNewHires * (inputs.currentTrainingHours - TRIKE_TRAINING_HOURS);

    return {
      totalEmployees,
      annualNewHires,
      currentTotalCost,
      trikeTotalCost,
      annualSavings,
      roiPercent,
      hoursRecovered,
      trikeSubscription,
      trikePerHireCost,
    };
  }, [inputs, perLocationRate, perHireRate]);

  const updateInput = (field: keyof typeof inputs, value: string) => {
    const num = parseFloat(value) || 0;
    setInputs((prev) => ({ ...prev, [field]: num }));
  };

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);

  const formatNumber = (n: number) =>
    new Intl.NumberFormat('en-US').format(n);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>ROI Calculator</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
          {/* Inputs */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Your Organization</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Number of Locations</Label>
                <Input type="number" value={inputs.locations} onChange={(e) => updateInput('locations', e.target.value)} min={1} />
              </div>
              <div>
                <Label>Avg Employees per Location</Label>
                <Input type="number" value={inputs.employeesPerLocation} onChange={(e) => updateInput('employeesPerLocation', e.target.value)} min={1} />
              </div>
              <div>
                <Label>Annual Turnover Rate (%)</Label>
                <Input type="number" value={inputs.turnoverRate} onChange={(e) => updateInput('turnoverRate', e.target.value)} min={0} max={300} />
              </div>
              <div>
                <Label>Avg Hourly Wage ($)</Label>
                <Input type="number" value={inputs.hourlyWage} onChange={(e) => updateInput('hourlyWage', e.target.value)} min={0} step={0.5} />
              </div>
              <div>
                <Label>Current Training Hours per New Hire</Label>
                <Input type="number" value={inputs.currentTrainingHours} onChange={(e) => updateInput('currentTrainingHours', e.target.value)} min={0} />
              </div>
              <div>
                <Label>Current Annual Platform Cost ($)</Label>
                <Input type="number" value={inputs.currentPlatformCost} onChange={(e) => updateInput('currentPlatformCost', e.target.value)} min={0} />
              </div>
            </CardContent>
          </Card>

          {/* Results */}
          <div className="space-y-4">
            <Card className={results.annualSavings > 0 ? 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/30' : 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/30'}>
              <CardContent className="pt-6 text-center">
                <p className="text-sm text-muted-foreground">Projected Annual Savings</p>
                <p className={`text-3xl font-bold ${results.annualSavings > 0 ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>
                  {formatCurrency(results.annualSavings)}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  {results.roiPercent > 0 ? `${results.roiPercent.toFixed(0)}% ROI` : ''}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6 space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Annual New Hires</span>
                  <span className="font-medium">{formatNumber(results.annualNewHires)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Hours Recovered / Year</span>
                  <span className="font-medium">{formatNumber(results.hoursRecovered)}</span>
                </div>
                <hr />
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Current Total Cost</span>
                  <span className="font-medium">{formatCurrency(results.currentTotalCost)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Trike Subscription</span>
                  <span className="font-medium">{formatCurrency(results.trikeSubscription)}/yr</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Trike Per-Hire Costs</span>
                  <span className="font-medium">{formatCurrency(results.trikePerHireCost)}/yr</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Trike Total Cost</span>
                  <span className="font-medium">{formatCurrency(results.trikeTotalCost)}/yr</span>
                </div>
              </CardContent>
            </Card>

            <p className="text-xs text-muted-foreground text-center">
              Trike reduces onboarding from {inputs.currentTrainingHours}hrs to {TRIKE_TRAINING_HOURS}hrs per hire
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
