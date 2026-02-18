'use client';

import { useEffect, useRef } from 'react';

interface UseScannerOptions {
    onScan: (barcode: string) => void;
    enabled: boolean;
    searchQuery: string;
    setSearchQuery: (q: string) => void;
}

export function useScanner({ onScan, enabled, searchQuery, setSearchQuery }: UseScannerOptions) {
    const onScanRef = useRef(onScan);
    const enabledRef = useRef(enabled);
    const searchQueryRef = useRef(searchQuery);
    const setSearchQueryRef = useRef(setSearchQuery);

    const scanBufferRef = useRef('');
    const scanTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const lastInputTimeRef = useRef(0);
    const fastCharCountRef = useRef(0);
    const preSearchQueryRef = useRef('');

    onScanRef.current = onScan;
    enabledRef.current = enabled;
    searchQueryRef.current = searchQuery;
    setSearchQueryRef.current = setSearchQuery;

    useEffect(() => {
        const SCAN_THRESHOLD_MS = 50;
        const MIN_SCAN_LENGTH = 5;

        const isInFormField = () => {
            const el = document.activeElement;
            if (!el) return false;
            const tag = el.tagName.toLowerCase();
            return tag === 'input' || tag === 'textarea' || tag === 'select' || (el as HTMLElement).isContentEditable;
        };

        const resetBuffer = () => {
            scanBufferRef.current = '';
            fastCharCountRef.current = 0;
            if (scanTimeoutRef.current) clearTimeout(scanTimeoutRef.current);
        };

        const handleKeyDown = (e: KeyboardEvent) => {
            if (!enabledRef.current) return;

            const now = Date.now();
            const timeSinceLastInput = now - lastInputTimeRef.current;
            const inField = isInFormField();

            // Enter key — check if we have a valid scan buffer
            if (e.key === 'Enter') {
                const buffer = scanBufferRef.current;
                if (buffer.length >= MIN_SCAN_LENGTH && fastCharCountRef.current >= MIN_SCAN_LENGTH) {
                    e.preventDefault();
                    e.stopPropagation();
                    if (!inField) setSearchQueryRef.current(preSearchQueryRef.current);
                    onScanRef.current(buffer);
                }
                resetBuffer();
                return;
            }

            // Only single printable characters
            if (e.key.length !== 1 || e.ctrlKey || e.metaKey || e.altKey) return;

            const isFastInput = timeSinceLastInput < SCAN_THRESHOLD_MS;

            // In a form field: only track fast (scanner) input, ignore slow (manual typing)
            if (inField) {
                if (isFastInput || fastCharCountRef.current >= 2) {
                    // This is scanner-speed input — capture it
                    fastCharCountRef.current++;
                    scanBufferRef.current += e.key;
                    lastInputTimeRef.current = now;

                    // After 3+ fast chars, start preventing default to stop chars entering the field
                    if (fastCharCountRef.current >= 3) {
                        e.preventDefault();
                        e.stopPropagation();
                    }

                    if (scanTimeoutRef.current) clearTimeout(scanTimeoutRef.current);
                    scanTimeoutRef.current = setTimeout(() => {
                        // If we got enough fast chars, fire scan
                        if (fastCharCountRef.current >= MIN_SCAN_LENGTH) {
                            onScanRef.current(scanBufferRef.current);
                        }
                        resetBuffer();
                    }, 200);
                } else {
                    // Slow typing — let it through normally, reset scanner buffer
                    resetBuffer();
                    lastInputTimeRef.current = now;
                }
                return;
            }

            // NOT in a form field — original scanner logic
            if (isFastInput || fastCharCountRef.current > 0) {
                if (fastCharCountRef.current === 0) preSearchQueryRef.current = searchQueryRef.current;
                fastCharCountRef.current++;
                scanBufferRef.current += e.key;
                lastInputTimeRef.current = now;

                if (fastCharCountRef.current >= 2) {
                    e.preventDefault();
                    e.stopPropagation();
                }

                if (scanTimeoutRef.current) clearTimeout(scanTimeoutRef.current);
                scanTimeoutRef.current = setTimeout(() => {
                    if (fastCharCountRef.current >= 2) setSearchQueryRef.current(preSearchQueryRef.current);
                    resetBuffer();
                }, 200);
            } else {
                scanBufferRef.current = e.key;
                fastCharCountRef.current = 0;
                lastInputTimeRef.current = now;
                preSearchQueryRef.current = searchQueryRef.current;

                if (scanTimeoutRef.current) clearTimeout(scanTimeoutRef.current);
                scanTimeoutRef.current = setTimeout(resetBuffer, 200);
            }
        };

        window.addEventListener('keydown', handleKeyDown, true);
        return () => {
            window.removeEventListener('keydown', handleKeyDown, true);
            if (scanTimeoutRef.current) clearTimeout(scanTimeoutRef.current);
        };
    }, []);
}