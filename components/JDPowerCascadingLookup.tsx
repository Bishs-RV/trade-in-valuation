'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { RVType } from '@/lib/types';
import { getCategoryId } from '@/lib/jdpower/rv-types';
import type { MakeCategory, ModelTrim } from '@/lib/jdpower/types';
import { SearchableCombobox, type ComboboxOption } from '@/components/ui/searchable-combobox';
import { GroupedModelPicker } from '@/components/GroupedModelPicker';
import { Field, FieldLabel } from '@/components/ui/field';
import { useIsLoadingPriorEval } from '@/lib/store';

interface JDPowerCascadingLookupProps {
  rvType: RVType;
  jdPowerManufacturerId: number | null;
  customManufacturer?: string;
  year: number | null;
  make: string;
  customMake?: string;
  customModel?: string;
  jdPowerModelTrimId: number | null;
  onUpdate: (updates: {
    jdPowerManufacturerId?: number | null;
    manufacturerName?: string;
    customManufacturer?: string;
    year?: number | null;
    make?: string;
    customMake?: string;
    model?: string;
    customModel?: string;
    jdPowerModelTrimId?: number | null;
  }) => void;
}

const labelClass = 'text-xs font-semibold text-gray-700';

export default function JDPowerCascadingLookup({
  rvType,
  jdPowerManufacturerId,
  customManufacturer,
  year,
  make,
  customMake,
  customModel,
  jdPowerModelTrimId,
  onUpdate,
}: JDPowerCascadingLookupProps) {
  // Check if we're loading a prior evaluation (skip cascading resets)
  const isLoadingPriorEval = useIsLoadingPriorEval();
  const isLoadingPriorEvalRef = useRef(isLoadingPriorEval);
  useEffect(() => {
    isLoadingPriorEvalRef.current = isLoadingPriorEval;
  }, [isLoadingPriorEval]);

  // Internal state for cascading data
  const [manufacturers, setManufacturers] = useState<MakeCategory[]>([]);
  const [years, setYears] = useState<number[]>([]);
  const [modelTrims, setModelTrims] = useState<ModelTrim[]>([]);
  const [isLoadingMakes, setIsLoadingMakes] = useState(false);
  const [isLoadingYears, setIsLoadingYears] = useState(false);
  const [isLoadingModels, setIsLoadingModels] = useState(false);

  // Use ref to avoid onUpdate in dependency arrays
  const onUpdateRef = useRef(onUpdate);
  useEffect(() => {
    onUpdateRef.current = onUpdate;
  });

  // Memoized options for comboboxes
  const yearOptions = useMemo<ComboboxOption[]>(
    () => years.map((y) => ({ value: y.toString(), label: y.toString() })),
    [years]
  );

  const manufacturerOptions = useMemo<ComboboxOption[]>(
    () =>
      manufacturers.map((m) => ({
        value: m.makeReturnTO.MakeID.toString(),
        label: m.makeReturnTO.MakeDisplayName,
      })),
    [manufacturers]
  );

  // Fetch manufacturers when rvType changes
  useEffect(() => {
    if (!rvType) {
      setManufacturers([]);
      return;
    }

    const abortController = new AbortController();
    setIsLoadingMakes(true);

    (async () => {
      try {
        const categoryId = getCategoryId(rvType);
        const response = await fetch(`/api/jdpower/makes?rvCategoryId=${categoryId}`, {
          signal: abortController.signal,
        });
        if (!response.ok) throw new Error('Failed to fetch manufacturers');
        const result = await response.json();
        setManufacturers(result.makes || []);
      } catch (error) {
        if (!abortController.signal.aborted) {
          console.error('Error fetching manufacturers:', error);
          setManufacturers([]);
        }
      } finally {
        setIsLoadingMakes(false);
      }
    })();

    // Skip cascading reset when loading a prior evaluation
    if (!isLoadingPriorEvalRef.current) {
      setYears([]);
      setModelTrims([]);
      onUpdateRef.current({
        jdPowerManufacturerId: null,
        manufacturerName: '',
        year: null,
        make: '',
        model: '',
        jdPowerModelTrimId: null,
      });
    }

    return () => abortController.abort();
  }, [rvType]);

  // Set manufacturerName when manufacturers load with a pre-selected ID (e.g., loading prior eval)
  useEffect(() => {
    if (jdPowerManufacturerId && manufacturers.length > 0) {
      const match = manufacturers.find(
        (m) => m.makeReturnTO.MakeID === jdPowerManufacturerId
      );
      if (match) {
        onUpdateRef.current({ manufacturerName: match.makeReturnTO.MakeDisplayName });
      }
    }
  }, [manufacturers, jdPowerManufacturerId]);

  // Fetch years when manufacturer changes
  useEffect(() => {
    if (!jdPowerManufacturerId) {
      setYears([]);
      return;
    }

    const abortController = new AbortController();
    setIsLoadingYears(true);

    (async () => {
      try {
        const response = await fetch(`/api/jdpower/years?makeId=${jdPowerManufacturerId}`, {
          signal: abortController.signal,
        });
        if (!response.ok) throw new Error('Failed to fetch years');
        const result = await response.json();
        setYears(result.years || []);
      } catch (error) {
        if (!abortController.signal.aborted) {
          console.error('Error fetching years:', error);
          setYears([]);
        }
      } finally {
        setIsLoadingYears(false);
      }
    })();

    // Skip cascading reset when loading a prior evaluation
    if (!isLoadingPriorEvalRef.current) {
      setModelTrims([]);
      onUpdateRef.current({
        year: null,
        make: '',
        model: '',
        jdPowerModelTrimId: null,
      });
    }

    return () => abortController.abort();
  }, [jdPowerManufacturerId]);

  // Fetch model trims when year changes
  useEffect(() => {
    if (!year || !rvType || !jdPowerManufacturerId) {
      setModelTrims([]);
      return;
    }

    const abortController = new AbortController();
    setIsLoadingModels(true);

    // Skip cascading reset when loading a prior evaluation
    if (!isLoadingPriorEvalRef.current) {
      setModelTrims([]);
      onUpdateRef.current({
        make: '',
        model: '',
        jdPowerModelTrimId: null,
      });
    }

    (async () => {
      try {
        const categoryId = getCategoryId(rvType);
        const response = await fetch(
          `/api/jdpower/model-trims?makeId=${jdPowerManufacturerId}&year=${year}&rvCategoryId=${categoryId}`,
          { signal: abortController.signal }
        );
        if (!response.ok) throw new Error('Failed to fetch models');
        const result = await response.json();
        setModelTrims(result.modelTrims || []);
      } catch (error) {
        if (!abortController.signal.aborted) {
          console.error('Error fetching models:', error);
          setModelTrims([]);
        }
      } finally {
        setIsLoadingModels(false);
      }
    })();

    return () => abortController.abort();
  }, [year, jdPowerManufacturerId, rvType]);

  const handleManufacturerChange = (option: ComboboxOption) => {
    if (option.isCustom) {
      onUpdate({
        jdPowerManufacturerId: null,
        manufacturerName: option.label,
        customManufacturer: option.label,
      });
      return;
    }

    const manufacturerId = parseInt(option.value, 10);
    if (!isNaN(manufacturerId)) {
      onUpdate({
        jdPowerManufacturerId: manufacturerId,
        manufacturerName: option.label,
        customManufacturer: undefined,
      });
    }
  };

  const handleYearChange = (option: ComboboxOption) => {
    const yearValue = parseInt(option.isCustom ? option.label : option.value, 10);
    if (!isNaN(yearValue) && yearValue >= 1980 && yearValue <= 2100) {
      onUpdate({ year: yearValue });
    }
  };

  const handleModelSelection = (
    modelTrim: ModelTrim | null,
    isCustom?: boolean,
    customValue?: string
  ) => {
    if (isCustom && customValue) {
      onUpdate({
        make: '',
        customMake: undefined,
        model: customValue,
        customModel: customValue,
        jdPowerModelTrimId: null,
      });
      return;
    }

    if (modelTrim) {
      onUpdate({
        make: modelTrim.ModelSeries,
        model: modelTrim.ModelTrimName,
        customMake: undefined,
        customModel: undefined,
        jdPowerModelTrimId: modelTrim.ModelTrimID,
      });
    }
  };

  return (
    <>
      {/* Manufacturer */}
      <Field>
        <FieldLabel className={labelClass}>
          Manufacturer <span className="text-red-600">*</span>
        </FieldLabel>
        <SearchableCombobox
          label="Manufacturer"
          placeholder="Select Manufacturer"
          searchPlaceholder="Search manufacturers..."
          options={manufacturerOptions}
          value={
            customManufacturer
              ? `custom:${customManufacturer}`
              : jdPowerManufacturerId?.toString() ?? null
          }
          onChange={handleManufacturerChange}
          isLoading={isLoadingMakes}
          disabled={!rvType}
          allowCustom={true}
        />
      </Field>

      {/* Year */}
      <Field>
        <FieldLabel className={labelClass}>
          Year <span className="text-red-600">*</span>
        </FieldLabel>
        <SearchableCombobox
          label="Year"
          placeholder="Select Year"
          searchPlaceholder="Search years..."
          options={yearOptions}
          value={
            year
              ? yearOptions.some((o) => o.value === year.toString())
                ? year.toString()
                : `custom:${year}`
              : null
          }
          onChange={handleYearChange}
          isLoading={isLoadingYears}
          disabled={!jdPowerManufacturerId && !customManufacturer}
          allowCustom={true}
        />
      </Field>

      {/* Model (grouped by Make) */}
      <Field>
        <FieldLabel className={labelClass}>
          Model/Floorplan <span className="text-red-600">*</span>
        </FieldLabel>
        <GroupedModelPicker
          modelTrims={modelTrims}
          value={jdPowerModelTrimId}
          customModel={customModel}
          make={customMake || make}
          onChange={handleModelSelection}
          isLoading={isLoadingModels}
          disabled={!year || (!jdPowerManufacturerId && !customManufacturer)}
          allowCustom={true}
        />
      </Field>
    </>
  );
}
