"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Mic01Icon,
  MicOff01Icon,
  SentIcon,
  RefreshIcon,
  AlertCircleIcon,
  CheckmarkCircle02Icon,
} from "@hugeicons/core-free-icons";
import { api, ApiError } from "@/lib/api";
import type { NlReportResponse } from "@/types/contract";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface KnownZone {
  id: string;
  name: string;
}

export function NLReporter() {
  const [text, setText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<NlReportResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [knownZones, setKnownZones] = useState<KnownZone[]>([]);

  const recognitionRef = useRef<InstanceType<typeof SpeechRecognition> | null>(null);

  useEffect(() => {
    api.getZones().then((zones) => {
      setKnownZones(zones.map((z) => ({ id: z.zone_id, name: z.name })));
    }).catch(() => {});
  }, []);

  const supportsVoice = typeof window !== "undefined" &&
    ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);

  const startListening = useCallback(() => {
    if (!supportsVoice) return;
    const SpeechRecognitionCtor =
      (window as unknown as { SpeechRecognition: typeof SpeechRecognition }).SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition: typeof SpeechRecognition }).webkitSpeechRecognition;

    if (!SpeechRecognitionCtor) return;

    const recognition = new SpeechRecognitionCtor();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "en-US";

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const transcript = event.results[0][0].transcript;
      setText((prev) => (prev ? `${prev} ${transcript}` : transcript));
      setIsListening(false);
    };

    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);

    recognitionRef.current = recognition;
    setIsListening(true);
    recognition.start();
  }, [supportsVoice]);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setIsListening(false);
  }, []);

  const handleSubmit = useCallback(async () => {
    const trimmed = text.trim();
    if (!trimmed) return;

    setIsSubmitting(true);
    setErrorMessage("");
    setResult(null);

    try {
      const res = await api.nlReport(trimmed);
      setResult(res);
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        const body = err.body as { message?: string } | null;
        setErrorMessage(body?.message || `API error ${err.status}`);
      } else {
        setErrorMessage(err instanceof Error ? err.message : "Failed to process natural language report");
      }
    } finally {
      setIsSubmitting(false);
    }
  }, [text]);

  const handleReset = useCallback(() => {
    setText("");
    setResult(null);
    setErrorMessage("");
  }, []);

  const getZoneDisplayName = (zoneId: string | null): string => {
    if (!zoneId) return "Unspecified";
    const found = knownZones.find((z) => z.id === zoneId);
    return found ? found.name : zoneId;
  };

  return (
    <div className="flex flex-col border-t border-hairline bg-surface">
      <div className="flex items-center justify-between border-b border-hairline px-3 py-2">
        <h2 className="font-heading text-xs font-semibold tracking-widest text-text-muted uppercase">
          Natural Language Incident Report
        </h2>
        {result && (
          <Button size="xs" variant="ghost" onClick={handleReset}>
            <HugeiconsIcon icon={RefreshIcon} className="size-3" />
            Reset
          </Button>
        )}
      </div>

      <div className="flex flex-col gap-2.5 p-3">
        <div className="relative">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Describe what you're seeing in the campus zones..."
            rows={3}
            className="min-h-[64px] w-full resize-none rounded-md border border-hairline bg-canvas px-2.5 py-2 pr-12 text-xs text-foreground outline-none placeholder:text-text-muted focus:border-brand-accent"
          />
          {supportsVoice && (
            <div className="absolute right-1.5 bottom-1.5">
              <Button
                size="icon-xs"
                variant={isListening ? "destructive" : "ghost"}
                onClick={isListening ? stopListening : startListening}
                title={isListening ? "Stop listening" : "Speak report"}
              >
                <HugeiconsIcon icon={isListening ? MicOff01Icon : Mic01Icon} />
              </Button>
            </div>
          )}
        </div>

        {isListening && (
          <div className="flex items-center gap-2 rounded-md bg-critical/10 px-2.5 py-1 text-xs text-critical">
            <span className="inline-block size-2 animate-pulse rounded-full bg-critical" />
            Listening for incident description...
          </div>
        )}

        <div className="flex justify-end">
          <Button
            size="sm"
            variant="default"
            disabled={!text.trim() || isSubmitting}
            onClick={handleSubmit}
            className="gap-1.5"
          >
            {isSubmitting ? (
              <>
                <span className="inline-block size-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                Processing Report...
              </>
            ) : (
              <>
                <HugeiconsIcon icon={SentIcon} className="size-3.5" />
                Submit Report
              </>
            )}
          </Button>
        </div>

        {errorMessage && (
          <div className="rounded-md border border-critical bg-critical/5 p-2.5 text-xs text-critical">
            <div className="flex items-center gap-1.5 font-semibold">
              <HugeiconsIcon icon={AlertCircleIcon} className="size-4" />
              Submission Error
            </div>
            <p className="mt-1 text-[0.6875rem] text-critical/90">{errorMessage}</p>
          </div>
        )}

        {result && (
          <div
            className={cn(
              "rounded-md border p-2.5 text-xs transition-colors",
              result.validation_gate === "passed"
                ? "border-hairline bg-canvas"
                : "border-hairline bg-canvas"
            )}
          >
            <div className="flex items-center gap-1.5 mb-2">
              <HugeiconsIcon
                icon={result.validation_gate === "passed" ? CheckmarkCircle02Icon : AlertCircleIcon}
                className={cn(
                  "size-4",
                  result.validation_gate === "passed" ? "text-safe" : "text-text-muted"
                )}
              />
              <span className="font-medium text-foreground">
                {result.validation_gate === "passed"
                  ? "Report Processed & Parsed"
                  : "Could not match a valid zone or hazard type from report."}
              </span>
            </div>

            {result.validation_gate === "passed" && (
              <div className="grid grid-cols-3 gap-2 border-t border-hairline pt-2 mt-1 text-xs">
                <div>
                  <span className="block text-[0.625rem] text-text-muted uppercase tracking-wide">
                    Zone
                  </span>
                  <span className="font-semibold text-foreground">
                    {getZoneDisplayName(result.extracted_signal.zone_id)}
                  </span>
                </div>
                <div>
                  <span className="block text-[0.625rem] text-text-muted uppercase tracking-wide">
                    Hazard
                  </span>
                  <span className="font-semibold text-foreground capitalize">
                    {result.extracted_signal.hazard_type || "Unspecified"}
                  </span>
                </div>
                <div>
                  <span className="block text-[0.625rem] text-text-muted uppercase tracking-wide">
                    Severity
                  </span>
                  <span className="font-semibold text-foreground">
                    {result.extracted_signal.estimated_severity}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
