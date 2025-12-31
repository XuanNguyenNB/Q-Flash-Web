/**
 * useDebouncedValue Hook
 * 
 * Debounces a value by delaying updates until after a specified delay period.
 * Useful for search inputs to prevent excessive re-renders.
 * 
 * @param value - The value to debounce
 * @param delay - Delay in milliseconds (default: 200ms)
 * @returns The debounced value
 */

import { useEffect, useState } from 'react';

export function useDebouncedValue<T>(value: T, delay: number = 200): T {
    const [debouncedValue, setDebouncedValue] = useState<T>(value);

    useEffect(() => {
        // Set up timeout to update debounced value after delay
        const timer = setTimeout(() => {
            setDebouncedValue(value);
        }, delay);

        // Cleanup: cancel timeout if value changes before delay expires
        return () => {
            clearTimeout(timer);
        };
    }, [value, delay]);

    return debouncedValue;
}
