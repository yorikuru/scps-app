"use client";

import React, { useState, useRef, useEffect } from "react";
import { ChevronDown, Check } from "lucide-react";

type Option = {
  value: string;
  label: string;
};

type Props = {
  value: string;
  options: Option[];
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  buttonClassName?: string;
  disabled?: boolean;
};

export default function CustomSelect({ 
  value, 
  options, 
  onChange, 
  placeholder = "選択してください", 
  className = "", 
  buttonClassName, 
  disabled = false 
}: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedOption = options.find((opt) => String(opt.value) === String(value));

  const defaultButtonClass = "w-full flex items-center justify-between px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg text-left focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs transition-colors text-[11px] font-bold";

  return (
    <div className={`relative ${className}`} ref={ref}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className={`${buttonClassName || defaultButtonClass} ${disabled ? "opacity-50 cursor-not-allowed bg-gray-50" : ""}`}
      >
        <span className={`block truncate ${!selectedOption ? "text-gray-400" : ""}`}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown className={`w-3 h-3 text-gray-400 transition-transform flex-shrink-0 ml-1.5 ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && !disabled && (
        <div className="absolute z-[100] mt-1 w-full min-w-[100px] bg-white border border-gray-200 rounded-lg shadow-xl max-h-48 overflow-y-auto custom-scrollbar py-0.5 animate-fade-in">
          {options.map((opt) => {
            const isSelected = String(opt.value) === String(value);
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  onChange(opt.value);
                  setIsOpen(false);
                }}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 text-left transition-colors hover:bg-gray-50 border-b border-gray-50 last:border-0 ${isSelected ? "bg-indigo-50/50 text-indigo-700" : "text-gray-700"}`}
              >
                <span className={`block truncate text-[11px] sm:text-[10px] ${isSelected ? "font-black" : "font-bold"}`}>
                  {opt.label}
                </span>
                {isSelected && <Check className="w-3 h-3 text-indigo-600 flex-shrink-0 ml-1.5" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}