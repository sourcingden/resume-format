import React, { useState, useRef } from 'react';
import { Upload, FileText, Loader2, Download, Edit2, Check, Copy, ArrowLeft, History } from 'lucide-react';
import { pdf } from '@react-pdf/renderer';
import { ResumeData } from './types';
import { parseResume } from './services/parserService';
import { extractTextFromPDF } from './utils/pdfParser';
import { ResumePreview } from './components/ResumePreview';
import { ResumeEditor } from './components/ResumeEditor';
import { ResumePDF } from './components/ResumePDF';

// Shadcn UI components
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import { Toaster } from '@/components/ui/sonner';
import { toast } from 'sonner';
import { useHistory } from './hooks/useHistory';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';

export default function App() {
  const [isLoading, setIsLoading] = useState(false);
  const [resumeData, setResumeData] = useState<ResumeData | null>(null);
  const [rawText, setRawText] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressText, setProgressText] = useState('');
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const { history, saveToHistory, clearHistory } = useHistory();

  const componentRef = useRef<HTMLDivElement>(null);

  const handlePrint = async () => {
    if (!resumeData) return;
    try {
      const candidateName = resumeData.name || 'Candidate';
      const position = resumeData.jobTitle || 'Position';
      const fileName = `${position} - ${candidateName} - CV 2026.pdf`;

      const blob = await pdf(<ResumePDF data={resumeData} />).toBlob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      link.click();
      URL.revokeObjectURL(url);
      toast.success('PDF Downloaded successfully!');
    } catch (err) {
      console.error('Failed to generate PDF', err);
      toast.error('Failed to generate PDF. Please try again.');
    }
  };

  const handleCopy = async () => {
    if (!componentRef.current) return;
    try {
      const text = componentRef.current.innerText;
      await navigator.clipboard.writeText(text);
      setIsCopied(true);
      toast.success('Text copied to clipboard!');
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text', err);
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(componentRef.current);
      selection?.removeAllRanges();
      selection?.addRange(range);
      try {
        document.execCommand('copy');
        setIsCopied(true);
        toast.success('Text copied to clipboard!');
        setTimeout(() => setIsCopied(false), 2000);
      } catch (innerErr) {
        toast.error('Failed to copy to clipboard');
      }
      selection?.removeAllRanges();
    }
  };

  const handleReset = () => {
    setResumeData(null);
    setRawText('');
    setIsEditing(false);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    setProgress(5);
    setProgressText('Reading file...');

    try {
      let text = '';
      if (file.type === 'application/pdf') {
        setProgressText('Extracting text from PDF...');
        setProgress(15);
        text = await extractTextFromPDF(file);
      } else {
        text = await file.text();
      }
      
      setRawText(text);
      await processText(text, true);
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : 'Failed to process file');
      setIsLoading(false);
    }
  };

  const processText = async (text: string, isFromFile = false) => {
    if (!text.trim()) {
      toast.error('Please provide some text to process.');
      return;
    }
    
    setIsLoading(true);
    
    if (!isFromFile) {
      setProgress(10);
      setProgressText('Preparing text...');
    }

    try {
      const data = await parseResume(text, (p, status) => {
        setProgress(p);
        setProgressText(status);
      });
      await new Promise(r => setTimeout(r, 200));
      setResumeData(data);
      saveToHistory(data, text);
      toast.success('Resume parsed successfully!');
    } catch (err) {
      console.error(err);
      toast.error('Failed to parse resume. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground font-sans">
      <Toaster position="top-right" theme="dark" duration={2000} />
      <header className="border-b border-border bg-card text-card-foreground sticky top-0 z-50 print:hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <FileText className="w-6 h-6 text-primary" />
            <h1 className="text-xl font-bold">Resume Converter</h1>
          </div>
          
          <div className="flex items-center space-x-3">
            <Sheet open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="sm">
                  <History className="w-4 h-4 sm:mr-2" />
                  <span className="hidden sm:inline">History</span>
                </Button>
              </SheetTrigger>
              <SheetContent className="flex flex-col h-full overflow-hidden w-[400px] sm:max-w-[540px]">
                <SheetHeader className="mb-6">
                  <SheetTitle>Conversion History</SheetTitle>
                  <SheetDescription>
                    Your last 10 successful resume conversions are saved locally.
                  </SheetDescription>
                </SheetHeader>
                
                {history.length === 0 ? (
                  <div className="flex items-center justify-center flex-grow">
                    <p className="text-muted-foreground text-sm text-center">No history yet.</p>
                  </div>
                ) : (
                  <div className="space-y-4 flex-grow overflow-y-auto pr-2 pb-4">
                    {history.map((item) => (
                      <Card 
                        key={item.id} 
                        className="cursor-pointer hover:bg-accent/50 transition-colors"
                        onClick={() => {
                          setResumeData(item.resumeData);
                          setRawText(item.rawText);
                          setIsEditing(false);
                          setIsHistoryOpen(false);
                          toast.success('Loaded from history');
                        }}
                      >
                        <CardHeader className="p-4">
                          <CardTitle className="text-base font-semibold text-primary">{item.name}</CardTitle>
                          <CardDescription className="text-sm font-medium">{item.jobTitle}</CardDescription>
                          <p className="text-xs text-muted-foreground mt-2">
                            {new Date(item.date).toLocaleString()}
                          </p>
                        </CardHeader>
                      </Card>
                    ))}
                  </div>
                )}
                {history.length > 0 && (
                  <div className="pt-6 border-t mt-auto">
                    <Button variant="destructive" size="sm" className="w-full" onClick={clearHistory}>
                       Clear History
                    </Button>
                  </div>
                )}
              </SheetContent>
            </Sheet>

          {resumeData && (
            <div className="flex space-x-3">
              <Button variant="outline" size="sm" onClick={handleReset} title="Start Over">
                <ArrowLeft className="w-4 h-4 mr-2" />
                <span className="hidden sm:inline">Start Over</span>
              </Button>
              <Button variant="outline" size="sm" onClick={() => setIsEditing(!isEditing)}>
                {isEditing ? <Check className="w-4 h-4 mr-2" /> : <Edit2 className="w-4 h-4 mr-2" />}
                <span>{isEditing ? 'Done' : 'Edit'}</span>
              </Button>
              <Button variant="outline" size="sm" onClick={handleCopy}>
                {isCopied ? <Check className="w-4 h-4 mr-2 text-green-500" /> : <Copy className="w-4 h-4 mr-2" />}
                <span className={isCopied ? "text-green-500" : ""}>{isCopied ? 'Copied' : 'Copy'}</span>
              </Button>
              <Button size="sm" onClick={handlePrint}>
                <Download className="w-4 h-4 mr-2" />
                <span>PDF</span>
              </Button>
            </div>
          )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 print:p-0 print:m-0 print:max-w-none">
        {!resumeData && !isLoading && (
          <div className="max-w-2xl mx-auto">
            <Card className="border-border">
              <CardHeader className="text-center pb-8 border-b border-border/50">
                <div className="w-16 h-16 bg-primary/10 text-primary rounded-full flex items-center justify-center mx-auto mb-6">
                  <Upload className="w-8 h-8" />
                </div>
                <CardTitle className="text-2xl font-bold mb-2">Upload your resume</CardTitle>
                <CardDescription className="text-base">
                  Upload a PDF or text file, and our AI will convert it.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6 pt-8">
                <div className="flex justify-center">
                  <Button asChild className="cursor-pointer py-6 px-8 text-md font-medium">
                    <label>
                      Select File (PDF, TXT)
                      <input 
                        type="file" 
                        className="hidden" 
                        accept=".pdf,.txt" 
                        onChange={handleFileUpload}
                      />
                    </label>
                  </Button>
                </div>
                
                <div className="relative flex items-center py-2">
                  <div className="flex-grow border-t border-border"></div>
                  <span className="flex-shrink-0 mx-4 text-muted-foreground text-sm uppercase tracking-wider">OR PASTE TEXT</span>
                  <div className="flex-grow border-t border-border"></div>
                </div>
                
                <Textarea
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                  placeholder="Paste your resume text here..."
                  className="w-full h-48 resize-none bg-background border-input"
                />
              </CardContent>
              <CardFooter>
                <Button 
                  onClick={() => processText(rawText)}
                  disabled={!rawText.trim()}
                  className="w-full h-12 text-md font-medium"
                >
                  Convert Text
                </Button>
              </CardFooter>
            </Card>
          </div>
        )}

        {isLoading && (
          <div className="flex flex-col items-center justify-center py-24 max-w-md mx-auto">
            <Loader2 className="w-12 h-12 text-primary animate-spin mb-6" />
            <h3 className="text-xl font-medium mb-4">Processing Resume</h3>
            
            <Progress value={progress} className="w-full h-2 mb-2" />
            
            <div className="flex justify-between w-full text-sm text-muted-foreground">
              <span>{progressText}</span>
              <span>{Math.round(progress)}%</span>
            </div>
          </div>
        )}

        {resumeData && !isLoading && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {isEditing && (
              <div className="lg:col-span-4 bg-card rounded-xl shadow-sm border border-border p-6 h-[calc(100vh-8rem)] overflow-y-auto sticky top-24 print:hidden">
                <h3 className="text-lg font-bold mb-4">Edit Data</h3>
                <ResumeEditor data={resumeData} onChange={setResumeData} />
              </div>
            )}
            
            <div className={`flex justify-center ${isEditing ? 'lg:col-span-8' : 'lg:col-span-12'} print:col-span-12 print:block print:w-full`}>
              <div className="bg-zinc-50 dark:bg-zinc-200 text-black shadow-2xl rounded-sm overflow-hidden border border-border print:shadow-none print:border-none print:m-0 print:p-0">
                <ResumePreview data={resumeData} ref={componentRef} />
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
