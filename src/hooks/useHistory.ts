import { useState, useEffect } from 'react';
import { ResumeData } from '../types';

export interface HistoryItem {
  id: string;
  date: string;
  name: string;
  jobTitle: string;
  resumeData: ResumeData;
  rawText: string;
}

const STORAGE_KEY = 'resume-formatter-history';
const MAX_HISTORY = 10;

export function useHistory() {
  const [history, setHistory] = useState<HistoryItem[]>([]);

  // Load from local storage strictly on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setHistory(JSON.parse(stored));
      }
    } catch (err) {
      console.error('Failed to parse history from local storage', err);
    }
  }, []);

  const saveToHistory = (resumeData: ResumeData, rawText: string) => {
    setHistory(prev => {
      // Avoid saving identical rapid consecutive parses
      if (prev.length > 0 && prev[0].rawText === rawText) {
        return prev;
      }

      const newItem: HistoryItem = {
        id: Date.now().toString() + Math.random().toString(36).substring(2, 9),
        date: new Date().toISOString(),
        name: resumeData.name || 'Unknown Candidate',
        jobTitle: resumeData.jobTitle || 'No Title',
        resumeData,
        rawText,
      };

      const newHistory = [newItem, ...prev].slice(0, MAX_HISTORY);
      
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(newHistory));
      } catch (err) {
        console.error('Failed to save history to local storage', err);
      }

      return newHistory;
    });
  };

  const clearHistory = () => {
    setHistory([]);
    localStorage.removeItem(STORAGE_KEY);
  };

  return { history, saveToHistory, clearHistory };
}
