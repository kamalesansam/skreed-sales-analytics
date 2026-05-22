"use client";

import React from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Checkbox } from "@/components/ui/checkbox";
import { PlusCircle } from "lucide-react";

export function FacetedFilter({
  title,
  options,
  selectedValues,
  onSelect,
  disabled
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 border-dashed" disabled={disabled || options.length === 0}>
          <PlusCircle className="mr-2 h-4 w-4" />
          {title}
          {selectedValues?.size > 0 && (
            <>
              <div className="mx-2 h-4 w-[1px] bg-border" />
              <Badge variant="secondary" className="rounded-sm px-1 font-normal lg:hidden">
                {selectedValues.size}
              </Badge>
              <div className="hidden space-x-1 lg:flex">
                {selectedValues.size > 2 ? (
                  <Badge variant="secondary" className="rounded-sm px-1 font-normal">
                    {selectedValues.size} selected
                  </Badge>
                ) : (
                  Array.from(selectedValues).map((option) => (
                    <Badge variant="secondary" key={option} className="rounded-sm px-1 font-normal">
                      {option}
                    </Badge>
                  ))
                )}
              </div>
            </>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[200px] p-0" align="start">
        <Command>
          <CommandInput placeholder={title} />
          <CommandList>
            <CommandEmpty>No results found.</CommandEmpty>
            <CommandGroup>
              {options.map((option) => {
                const isSelected = selectedValues.size === 0 ? true : selectedValues.has(option);
                return (
                  <CommandItem
                    key={option}
                    onSelect={() => {
                      onSelect(option, false, options);
                    }}
                    className="group flex items-center justify-between cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <Checkbox checked={isSelected} tabIndex={-1} className="pointer-events-none" />
                      <span>{option}</span>
                    </div>
                    
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="hidden group-hover:flex h-6 px-2 text-[10px] uppercase font-semibold"
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        onSelect(option, true, options);
                      }}
                    >
                      ONLY
                    </Button>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
