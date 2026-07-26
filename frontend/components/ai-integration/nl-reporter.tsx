"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Microphone01Icon,
  MicrophoneOff01Icon,
  AiMind01Icon,
  Send01Icon,
  RefreshIcon,
  AlertCircleIcon,
  CheckmarkCircle02Icon,
  InformationCircleIcon,
} from "@hugeicons/core-free-icons";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { parseWithGemini, type GeminiParseResult } from "./reasoning";
import {
  validateExtractedSignal,
  getZoneName,
  formatSeverity,
  hazardLabel,
  type KnownZone,
} from "./validation";

const GEMINI_KEY_ENV = typeof process !== "undefined"
  ? process.env.NEXT_PUBLIC_GEMINI_API_KEY
  : undefined;

type Stage =
  | "idle"
  | "parsing"
  | "validating"
  | "ready"
  | "submitting"
  | "done"
  | "error";

export function NLReporter() {
  const [text, setText] = useState("");
  const [apiKey, setApiKey] = useState(GEMINI_KEY_ENV || "");
  const [showKeyInput, setShowKeyInput] = useState(!GEMINI_KEY_ENV);
  const [stage, setStage] = useState<Stage>("idle");
  const [geminiParseResult, setGeminiParseResult] = useState<GeminiParseResult | null>(null);
  const [validation, setValidation] = useState<ReturnType<typeof validateExtractedSignal> | null>(null);
  const [backendResult, setBackendResult] = useState<unknown>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [knownZones, setKnownZones] = useState<KnownZone[]>([]);
  const [zonesLoaded, setZonesLoaded] = useState(false);

  const recognitionRef = useRef<InstanceType<typeof SpeechRecognition> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    api.getZones().then((zones) => {
      setKnownZones(zones.map((z: { id: string; name: string }) => ({ id: z.id, name: z.name })));
      setZonesLoaded(true);
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

    recognition.onerror = () => {
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    setIsListening(true);
    recognition.start();
  }, [supportsVoice]);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setIsListening(false);
  }, []);

  const handleParse = useCallback(async () => {
    if (!text.trim() || !apiKey.trim()) return;
    if (!zonesLoaded) return;

    setStage("parsing");
    setErrorMessage("");
    setGeminiParseResult(null);
    setValidation(null);
    setBackendResult(null);

    abortRef.current = new AbortController();

    try {
      const result = await parseWithGemini(text.trim(), apiKey.trim(), abortRef.current.signal);

      setGeminiParseResult(result);
      setStage("validating");

      const vResult = validateExtractedSignal(result, knownZones);
      setValidation(vResult);

      if (vResult.valid) {
        setStage("ready");
      } else {
        setStage("idle");
      }
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setErrorMessage(err instanceof Error ? err.message : "Failed to parse report");
      setStage("error");
    }
  }, [text, apiKey, knownZones, zonesLoaded]);

  const handleSubmit = useCallback(async () => {
    if (!text.trim()) return;

    setStage("submitting");
    setErrorMessage("");

    try {
      const result = await api.nlReport(text.trim());
      setBackendResult(result);
      setStage("done");
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        const body = err.body as { message?: string } | null;
        setErrorMessage(body?.message || `API error ${err.status}`);
      } else {
        setErrorMessage(err instanceof Error ? err.message : "Failed to submit report");
      }
      setStage("error");
    }
  }, [text]);

  const handleReset = useCallback(() => {
    setText("");
    setStage("idle");
    setGeminiParseResult(null);
    setValidation(null);
    setBackendResult(null);
    setErrorMessage("");
    abortRef.current?.abort();
  }, []);

  const handleRetry = useCallback(() => {
    setStage("idle");
    setGeminiParseResult(null);
    setValidation(null);
    setBackendResult(null);
    setErrorMessage("");
  }, []);

  const needsKey = !apiKey.trim();

  return (
    <div className="flex flex-col border-t border-hairline bg-surface">
      <div className="flex items-center justify-between border-b border-hairline px-3 py-2">
        <h2 className="font-heading text-xs font-semibold tracking-widest text-text-muted uppercase">
          AI Reporter
        </h2>
        <div className="flex items-center gap-1">
          {zonesLoaded && (
            <span className="text-[0.625rem] text-text-muted">
              {knownZones.length} zones
            </span>
          )}
          {stage !== "idle" && (
            <Button size="xs" variant="ghost" onClick={handleReset}>
              <HugeiconsIcon icon={RefreshIcon} className="size-3" />
              Reset
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-2 p-3">
        {showKeyInput && (
          <div className="flex flex-col gap-1">
            <label className="text-[0.625rem] font-medium text-text-muted">
              Gemini API Key
              <span className="ml-1 text-text-muted">(get one at ai.google.dev)</span>
            </label>
            <div className="flex gap-1">
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Enter your Gemini API key"
                className="min-w-0 flex-1 rounded-md border border-hairline bg-canvas px-2 py-1.5 text-xs text-foreground outline-none placeholder:text-text-muted focus:border-brand-accent"
              />
              <Button size="sm" variant="ghost" onClick={() => setShowKeyInput(false)}>
                Done
              </Button>
            </div>
          </div>
        )}

        <div className="relative">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder='e.g. "smell of gas near the IoT Lab bench, not sure how bad"'
            rows={3}
            className="min-h-[64px] w-full resize-none rounded-md border border-hairline bg-canvas px-2.5 py-2 pr-16 text-xs text-foreground outline-none placeholder:text-text-muted focus:border-brand-accent"
          />
          <div className="absolute right-1.5 bottom-1.5 flex gap-0.5">
            {supportsVoice && (
              <Button
                size="icon-xs"
                variant={isListening ? "destructive" : "ghost"}
                onClick={isListening ? stopListening : startListening}
              >
                <HugeiconsIcon
                  icon={isListening ? MicrophoneOff01Icon : Microphone01Icon}
                />
              </Button>
            )}
          </div>
        </div>

        {isListening && (
          <div className="flex items-center gap-2 rounded-md bg-critical/10 px-2.5 py-1.5">
            <span className="inline-block size-2 animate-pulse rounded-full bg-critical" />
            <span className="text-xs text-critical">Listening...</span>
          </div>
        )}

        <div className="flex gap-1.5">
          <Button
            size="sm"
            variant="default"
            className="flex-1"
            disabled={!text.trim() || needsKey || stage === "parsing" || !zonesLoaded}
            onClick={handleParse}
          >
            {stage === "parsing" ? (
              <>
                <span className="inline-block size-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                Parsing...
              </>
            ) : (
              <>
                <HugeiconsIcon icon={AiMind01Icon} />
                Parse with AI
              </>
            )}
          </Button>

          {stage === "ready" && (
            <Button
              size="sm"
              variant="destructive"
              onClick={handleSubmit}
              disabled={stage === "submitting"}
            >
              {stage === "submitting" ? (
                <>
                  <span className="inline-block size-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Submitting...
                </>
              ) : (
                <>
                  <HugeiconsIcon icon={Send01Icon} />
                  Submit Report
                </>
              )}
            </Button>
          )}
        </div>

        {needsKey && !showKeyInput && (
          <p className="text-[0.625rem] text-text-muted">
            <button
              onClick={() => setShowKeyInput(true)}
              className="text-brand-accent underline underline-offset-2"
            >
              Set Gemini API key
            </button>{" "}
            to enable AI parsing.
          </p>
        )}

        {!zonesLoaded && stage !== "idle" && (
          <p className="text-xs text-text-muted">Loading zone data...</p>
        )}

        {geminiParseResult && validation && (
          <div
            className={cn(
              "rounded-md border p-2.5",
              validation.valid
                ? "border-safe bg-safe/5"
                : "border-critical bg-critical/5"
            )}
          >
            <div className="flex items-center gap-1.5 mb-1.5">
              <HugeiconsIcon
                icon={validation.valid ? CheckmarkCircle02Icon : AlertCircleIcon}
                className={cn(
                  "size-4",
                  validation.valid ? "text-safe" : "text-critical"
                )}
              />
              <span
                className={cn(
                  "text-xs font-semibold",
                  validation.valid ? "text-safe" : "text-critical"
                )}
              >
                {validation.valid ? "Signal extracted" : "Could not resolve"}
              </span>
              <Badge
                variant={validation.valid ? "outline" : "destructive"}
                className="ml-auto"
              >
                Validation {validation.valid ? "passed" : "failed"}
              </Badge>
            </div>

            <div className="grid grid-cols-3 gap-2 text-xs">
              <div>
                <span className="block text-[0.625rem] text-text-muted">Zone</span>
                <span className="font-medium text-foreground">
                  {geminiParseResult.zone_id
                    ? getZoneName(geminiParseResult.zone_id, knownZones)
                    : "—"}
                </span>
              </div>
              <div>
                <span className="block text-[0.625rem] text-text-muted">Hazard</span>
                <span className="font-medium text-foreground">
                  {geminiParseResult.hazard_type
                    ? hazardLabel(geminiParseResult.hazard_type)
                    : "—"}
                </span>
              </div>
              <div>
                <span className="block text-[0.625rem] text-text-muted">Severity</span>
                <span className="font-medium text-foreground">
                  {formatSeverity(geminiParseResult.estimated_severity)}
                </span>
              </div>
            </div>

            {!validation.valid && validation.errors.length > 0 && (
              <ul className="mt-2 space-y-0.5">
                {validation.errors.map((err, i) => (
                  <li key={i} className="flex items-start gap-1 text-[0.625rem] text-critical">
                    <HugeiconsIcon icon={AlertCircleIcon} className="mt-px size-2.5 shrink-0" />
                    {err}
                  </li>
                ))}
              </ul>
            )}

            {validation.valid && (
              <p className="mt-2 flex items-start gap-1 text-[0.625rem] text-safe">
                <HugeiconsIcon icon={InformationCircleIcon} className="mt-px size-2.5 shrink-0" />
                This structured signal will be validated by the backend before affecting the system.
              </p>
            )}
          </div>
        )}

        {backendResult && stage === "done" && (
          <div className="rounded-md border border-safe bg-safe/5 p-2.5">
            <div className="flex items-center gap-1.5 mb-1">
              <HugeiconsIcon icon={CheckmarkCircle02Icon} className="size-4 text-safe" />
              <span className="text-xs font-semibold text-safe">
                Report submitted successfully
              </span>
            </div>
            <p className="text-[0.625rem] text-text-muted">
              Backend validation gate: <span className="font-medium text-foreground">
                {(backendResult as { validation_gate?: string }).validation_gate}
              </span>
              {(backendResult as { incident_id?: string | null }).incident_id && (
                <> &middot; Incident ID: <span className="font-mono text-foreground">
                  {(backendResult as { incident_id: string }).incident_id.slice(0, 8)}...
                </span></>
              )}
            </p>
          </div>
        )}

        {stage === "error" && errorMessage && (
          <div className="rounded-md border border-critical bg-critical/5 p-2.5">
            <div className="flex items-center gap-1.5">
              <HugeiconsIcon icon={AlertCircleIcon} className="size-4 text-critical" />
              <span className="text-xs font-semibold text-critical">Error</span>
            </div>
            <p className="mt-0.5 text-[0.625rem] text-critical/80">{errorMessage}</p>
            <Button size="xs" variant="ghost" className="mt-1.5" onClick={handleRetry}>
              <HugeiconsIcon icon={RefreshIcon} className="size-3" />
              Retry
            </Button>
          </div>
        )}

        {stage === "idle" && !validation && (
          <p className="text-[0.625rem] leading-relaxed text-text-muted">
            Type a hazard report or tap the microphone to speak. Then click{" "}
            <span className="text-foreground">Parse with AI</span> to extract a
            structured signal. The output is validated against known zones and
            hazard types before submission.
          </p>
        )}
      </div>
    </div>
  );
}
