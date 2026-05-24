/**
 * Create Collection Form Component
 * Form for creating a new collection with auto-detected fields
 */

"use client";

import React, { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Check } from "lucide-react";
import type {
  CreateCollectionFormProps,
  CreateCollectionInput,
  FieldType,
  CollectionFieldSchema,
} from "../types";

const FIELD_TYPES: { value: FieldType; label: string }[] = [
  { value: "text", label: "Text" },
  { value: "number", label: "Number" },
  { value: "boolean", label: "Boolean" },
  { value: "date", label: "Date" },
  { value: "email", label: "Email" },
  { value: "url", label: "URL" },
  { value: "phone", label: "Phone" },
  { value: "select", label: "Select" },
];

const getFieldTypeColor = (type: string): string => {
  const colors: Record<string, string> = {
    text: "bg-blue-100 text-blue-800",
    number: "bg-green-100 text-green-800",
    boolean: "bg-purple-100 text-purple-800",
    date: "bg-orange-100 text-orange-800",
    email: "bg-pink-100 text-pink-800",
    url: "bg-indigo-100 text-indigo-800",
    phone: "bg-cyan-100 text-cyan-800",
    select: "bg-yellow-100 text-yellow-800",
  };
  return colors[type] || "bg-gray-100 text-gray-800";
};

interface CreateCollectionFormData {
  name: string;
  description: string;
}

export const CreateCollectionForm: React.FC<CreateCollectionFormProps> = ({
  suggestedName,
  suggestedFields,
  onSubmit,
  onCancel,
  isLoading = false,
}) => {
  const [fields, setFields] = useState<CollectionFieldSchema[]>([]);
  const [editingFieldIndex, setEditingFieldIndex] = useState<number | null>(
    null
  );

  const { register, handleSubmit, watch } = useForm<CreateCollectionFormData>({
    defaultValues: {
      name: suggestedName || "",
      description: "",
    },
  });

  // Initialize fields from suggestions
  useEffect(() => {
    if (suggestedFields && suggestedFields.length > 0) {
      const initialFields: CollectionFieldSchema[] = suggestedFields.map(
        (field) => ({
          name: field.name,
          displayName: field.displayName,
          type: field.type,
          required: false,
        })
      );
      setFields(initialFields);
    }
  }, [suggestedFields]);

  const handleRemoveField = (index: number) => {
    setFields((prev) => prev.filter((_, i) => i !== index));
  };

  const handleChangeFieldType = (index: number, newType: FieldType) => {
    setFields((prev) => {
      const updated = [...prev];
      updated[index].type = newType;
      return updated;
    });
  };

  const onFormSubmit = (data: CreateCollectionFormData) => {
    const input: CreateCollectionInput = {
      name: data.name,
      description: data.description || undefined,
      fields,
    };
    onSubmit(input);
  };

  const formName = watch("name");

  return (
    <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-6">
      {/* Collection Name */}
      <div className="space-y-2">
        <Label htmlFor="name" className="font-semibold">
          Collection Name
        </Label>
        <Input
          id="name"
          placeholder="e.g., Customers, Products, Orders"
          disabled={isLoading}
          {...register("name", {
            required: "Collection name is required",
            minLength: {
              value: 2,
              message: "Name must be at least 2 characters",
            },
          })}
        />
      </div>

      {/* Description */}
      <div className="space-y-2">
        <Label htmlFor="description">Description (optional)</Label>
        <Textarea
          id="description"
          placeholder="Describe what this collection is for..."
          disabled={isLoading}
          rows={3}
          {...register("description")}
        />
      </div>

      {/* Fields Management */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="font-semibold">Fields ({fields.length})</Label>
        </div>

        {fields.length === 0 ? (
          <div className="p-4 rounded-lg bg-gray-50 border border-gray-200 text-center">
            <p className="text-sm text-gray-600">
              Fields will be auto-created from your file columns
            </p>
          </div>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {fields.map((field, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-3 rounded-lg border border-gray-200 bg-gray-50 hover:bg-gray-100 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm text-gray-900 truncate">
                    {field.displayName}
                  </p>
                  <p className="text-xs text-gray-500">{field.name}</p>
                </div>

                <Select
                  value={field.type}
                  onValueChange={(value) =>
                    handleChangeFieldType(idx, value as FieldType)
                  }
                  disabled={isLoading}
                >
                  <SelectTrigger className="w-28 h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FIELD_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRemoveField(idx)}
                  disabled={isLoading}
                  className="ml-2 text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  Remove
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Form Actions */}
      <div className="flex gap-3 justify-end pt-4 border-t border-gray-200">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isLoading}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={!formName || isLoading || fields.length === 0}
        >
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Creating...
            </>
          ) : (
            <>
              <Check className="h-4 w-4 mr-2" />
              Create Collection
            </>
          )}
        </Button>
      </div>
    </form>
  );
};
