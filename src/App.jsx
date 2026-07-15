import React, { useState, useRef, useEffect, useMemo } from "react";
import Papa from "papaparse";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { BookOpen, LineChart as LineChartIcon, PenLine, Upload, Send, Loader2, AlertTriangle, Mic, MicOff, Volume2, VolumeX, Paperclip, X, FileText } from "lucide-react";
import * as mammoth from "mammoth";

// Extracts readable text from an uploaded file (.txt, .md, .csv as plain text, .docx via mammoth)
async function extractFileText(file) {
  const name = file.name.toLowerCase();
  if (name.endsWith(".docx")) {
    const buf = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer: buf });
    return result.value;
  }
  return await file.text();
}

function isImageFile(file) {
  return file.type.startsWith("image/");
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const MODES = {
  cours: {
    key: "cours",
    label: "Cours",
    icon: BookOpen,
    tagline: "Comprendre",
    system: `Tu es un tuteur expert en épidémiologie et santé publique, qui explique à un étudiant en Licence à l'ENATSE (École Nationale des Techniciens Supérieurs en Santé Publique et Surveillance Épidémiologique, Université de Parakou, Bénin). Réponds toujours de façon complète et précise, jamais vague ni générique — donne des définitions exactes, des formules quand pertinent (ex: incidence = nouveaux cas / population à risque × temps), et des exemples concrets de terrain africain. Structure claire avec des points si utile. Ne coupe jamais ta réponse avant d'avoir traité la question en entier.`,
    placeholder: "Colle un extrait de cours ou pose ta question (ex: différence incidence/prévalence)…",
  },
  analyse: {
    key: "analyse",
    label: "Analyse",
    icon: LineChartIcon,
    tagline: "Interpréter",
    system: `Tu es un épidémiologiste analyste de données. Quand l'utilisateur fournit des données (ligne de liste, séries temporelles de cas), tu appliques les conventions du domaine : calcul d'incidence, de taux d'attaque, identification de la courbe épidémique (source ponctuelle, propagée, mixte), interprétation des tendances, et alertes seuil si pertinent. Cite les chiffres précis fournis, ne les invente jamais. Structure ta réponse : 1) Constat chiffré, 2) Interprétation épidémiologique, 3) Limites/précautions.`,
    placeholder: "Décris tes données ou pose une question sur le graphique importé…",
  },
  redaction: {
    key: "redaction",
    label: "Rédaction",
    icon: PenLine,
    tagline: "Rédiger",
    system: `Tu es un assistant de rédaction scientifique en santé publique. Tu aides à rédiger selon les normes du domaine : structure IMRAD (Introduction, Méthodes, Résultats, Discussion), grille STROBE pour les études observationnelles, style factuel et neutre, citations au format Vancouver si demandé. Tu proposes des reformulations précises, signales les lacunes de structure, et gardes un registre académique en français.`,
    placeholder: "Colle ton brouillon ou décris ce que tu dois rédiger (rapport, mémoire, article)…",
  },
};

function EpiCurveSignature() {
  const data = [2, 3, 3, 5, 8, 13, 19, 24, 21, 15, 9, 6, 4, 3, 2];
  const [drawn, setDrawn] = useState(0);
  useEffect(() => {
    if (drawn >= data.length) return;
    const t = setTimeout(() => setDrawn((d) => d + 1), 55);
    return () => clearTimeout(t);
  }, [drawn]);
  const max = Math.max(...data);
  return (
    <svg viewBox="0 0 300 70" className="w-full h-16" preserveAspectRatio="none">
      <line x1="0" y1="18" x2="300" y2="18" stroke="#B33F2E" strokeDasharray="3 4" strokeWidth="1" opacity="0.6" />
      {data.map((v, i) => {
        const shown = i < drawn;
        const h = (v / max) * 52;
        const w = 300 / data.length;
        return (
          <rect
            key={i}
            x={i * w + 2}
            y={shown ? 66 - h : 66}
            width={w - 4}
            height={shown ? h : 0}
            fill={v >= 13 ? "#B33F2E" : "#2F6E62"}
            style={{ transition: "height 0.35s ease, y 0.35s ease" }}
            rx="1.5"
          />
        );
      })}
    </svg>
  );
}

function ChatPane({ mode, apiCall }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [attachment, setAttachment] = useState(null);
  const [recording, setRecording] = useState(false);
  const [speakingIndex, setSpeakingIndex] = useState(null);
  const endRef = useRef(null);
  const fileRef = useRef(null);
  const recognitionRef = useRef(null);

  const speechSupported = typeof window !== "undefined" && (window.SpeechRecognition || window.webkitSpeechRecognition);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
      window.speechSynthesis?.cancel();
    };
  }, []);

  function toggleRecording() {
    if (!speechSupported) return;
    if (recording) {
      recognitionRef.current?.stop();
      setRecording(false);
      return;
    }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SR();
    recognition.lang = "fr-FR";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onresult = (e) => {
      const transcript = e.results[0][0].transcript;
      setInput((prev) => (prev ? prev + " " + transcript : transcript));
    };
    recognition.onend = () => setRecording(false);
    recognition.onerror = () => setRecording(false);
    recognitionRef.current = recognition;
    recognition.start();
    setRecording(true);
  }

  function speak(text, index) {
    if (!window.speechSynthesis) return;
    if (speakingIndex === index) {
      window.speechSynthesis.cancel();
      setSpeakingIndex(null);
      return;
    }
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = "fr-FR";
    utter.onend = () => setSpeakingIndex(null);
    utter.onerror = () => setSpeakingIndex(null);
    window.speechSynthesis.speak(utter);
    setSpeakingIndex(index);
  }

  async function handleFileUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      if (isImageFile(file)) {
        const base64 = await fileToBase64(file);
        setAttachment({ name: file.name, isImage: true, mediaType: file.type, base64 });
      } else {
        const content = await extractFileText(file);
        setAttachment({ name: file.name, isImage: false, content });
      }
    } catch (err) {
      setError("Impossible de lire ce fichier. Essaie en .txt, .md, .docx, .jpg ou .png.");
    }
    e.target.value = "";
  }

  async function send() {
    const text = input.trim();
    if ((!text && !attachment) || loading) return;

    let userContentForApi;
    let userContentForDisplay;

    if (attachment?.isImage) {
      userContentForApi = [
        { type: "image", source: { type: "base64", media_type: attachment.mediaType, data: attachment.base64 } },
        { type: "text", text: text || "Que peux-tu me dire sur cette image dans un contexte épidémiologique ?" },
      ];
      userContentForDisplay = `${text || "Image jointe"} 📎 ${attachment.name}`;
    } else if (attachment) {
      const composed = `${text || "Voici un document à examiner."}\n\n[Document joint : ${attachment.name}]\n${attachment.content}`;
      userContentForApi = composed;
      userContentForDisplay = composed;
    } else {
      userContentForApi = text;
      userContentForDisplay = text;
    }

    const next = [...messages, { role: "user", content: userContentForDisplay, apiContent: userContentForApi }];
    setMessages(next);
    setInput("");
    setAttachment(null);
    setLoading(true);
    setError(null);
    try {
      const reply = await apiCall(mode.system, next);
      setMessages((m) => [...m, { role: "assistant", content: reply }]);
    } catch (e) {
      setError("La requête a échoué. Réessaie dans un instant.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto px-1 py-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-sm text-[#5b5347] font-serif italic pr-8">
            {mode.key === "cours" && "Pose une question de cours, ou colle un extrait à décortiquer."}
            {mode.key === "analyse" && "Décris une situation de terrain ou colle tes chiffres pour une lecture épidémiologique."}
            {mode.key === "redaction" && "Colle un paragraphe ou décris la section à rédiger — j'appliquerai la structure attendue."}
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[85%] flex flex-col gap-1.5 ${m.role === "user" ? "items-end" : "items-start"}`}>
              <div
                className={`rounded-sm px-4 py-3 text-[14.5px] leading-relaxed whitespace-pre-wrap ${
                  m.role === "user"
                    ? "bg-[#16211D] text-[#EDE7D9] font-sans"
                    : "bg-[#F6F2E6] text-[#16211D] font-sans border border-[#D8CFB8]"
                }`}
              >
                {m.content}
              </div>
              {m.role === "assistant" && (
                <button
                  onClick={() => speak(m.content, i)}
                  className="flex items-center gap-1 text-[11px] text-[#928a76] hover:text-[#2F6E62] transition-colors pl-1"
                >
                  {speakingIndex === i ? <VolumeX className="w-3 h-3" /> : <Volume2 className="w-3 h-3" />}
                  {speakingIndex === i ? "Arrêter" : "Écouter"}
                </button>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex items-center gap-2 text-[#5b5347] text-sm pl-1">
            <Loader2 className="w-4 h-4 animate-spin" /> Analyse en cours…
          </div>
        )}
        {error && (
          <div className="flex items-center gap-2 text-[#B33F2E] text-sm pl-1">
            <AlertTriangle className="w-4 h-4" /> {error}
          </div>
        )}
        <div ref={endRef} />
      </div>
      <div className="border-t border-[#D8CFB8] pt-3 flex flex-col gap-2">
        {attachment && (
          <div className="flex items-center gap-2 bg-[#F6F2E6] border border-[#D8CFB8] rounded-sm px-3 py-1.5 text-[12.5px] text-[#5b5347] w-fit">
            {attachment.isImage ? (
              <img src={`data:${attachment.mediaType};base64,${attachment.base64}`} alt="" className="w-6 h-6 object-cover rounded-sm" />
            ) : (
              <FileText className="w-3.5 h-3.5 text-[#2F6E62]" />
            )}
            {attachment.name}
            <button onClick={() => setAttachment(null)} className="text-[#928a76] hover:text-[#B33F2E]">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
        <div className="flex gap-2 items-end">
          <button
            onClick={() => fileRef.current?.click()}
            title="Joindre un fichier (.txt, .md, .docx) ou une photo"
            className="shrink-0 bg-[#F6F2E6] border border-[#D8CFB8] hover:border-[#2F6E62] text-[#5b5347] rounded-sm p-2.5 transition-colors"
          >
            <Paperclip className="w-4 h-4" />
          </button>
          <input ref={fileRef} type="file" accept=".txt,.md,.docx,.csv,image/jpeg,image/png,image/webp" onChange={handleFileUpload} className="hidden" />

          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder={mode.placeholder}
            rows={2}
            className="flex-1 resize-none bg-[#F6F2E6] border border-[#D8CFB8] rounded-sm px-3 py-2 text-[14px] font-sans text-[#16211D] focus:outline-none focus:ring-2 focus:ring-[#2F6E62] placeholder:text-[#928a76]"
          />

          <button
            onClick={toggleRecording}
            disabled={!speechSupported}
            title={speechSupported ? "Dicter au micro" : "Micro non supporté par ce navigateur"}
            className={`shrink-0 rounded-sm p-2.5 transition-colors border ${
              recording
                ? "bg-[#B33F2E] border-[#B33F2E] text-[#EDE7D9] animate-pulse"
                : "bg-[#F6F2E6] border-[#D8CFB8] hover:border-[#2F6E62] text-[#5b5347] disabled:opacity-40"
            }`}
          >
            {recording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>

          <button
            onClick={send}
            disabled={loading}
            className="bg-[#B33F2E] hover:bg-[#9c3527] disabled:opacity-50 text-[#EDE7D9] rounded-sm p-2.5 transition-colors"
            aria-label="Envoyer"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function AnalysePane({ apiCall }) {
  const [rows, setRows] = useState(null);
  const [fileName, setFileName] = useState(null);
  const [question, setQuestion] = useState("");
  const [interpretation, setInterpretation] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const fileRef = useRef(null);

  const numericCols = useMemo(() => {
    if (!rows || rows.length === 0) return [];
    return Object.keys(rows[0]).filter((k) => rows.every((r) => !isNaN(parseFloat(r[k])) || r[k] === ""));
  }, [rows]);

  const labelCol = rows && rows.length ? Object.keys(rows[0])[0] : null;

  function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => setRows(res.data),
    });
  }

  async function analyse() {
    if (!rows) return;
    setLoading(true);
    setError(null);
    try {
      const sample = rows.slice(0, 60);
      const prompt = `Voici des données de terrain (CSV, ${rows.length} lignes au total, échantillon ci-dessous en JSON) :\n${JSON.stringify(sample)}\n\nQuestion de l'utilisateur : ${question || "Fais une lecture épidémiologique générale de ces données (tendance, type de courbe, points d'attention)."}`;
      const reply = await apiCall(MODES.analyse.system, [{ role: "user", content: prompt }]);
      setInterpretation(reply);
    } catch (e) {
      setError("L'analyse a échoué. Réessaie.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col h-full gap-4 overflow-y-auto pr-1">
      <div
        onClick={() => fileRef.current?.click()}
        className="border border-dashed border-[#928a76] rounded-sm p-5 text-center cursor-pointer hover:border-[#2F6E62] transition-colors bg-[#F6F2E6]"
      >
        <Upload className="w-5 h-5 mx-auto mb-2 text-[#2F6E62]" />
        <p className="text-sm text-[#5b5347] font-sans">
          {fileName ? `Fichier chargé : ${fileName} (${rows?.length ?? 0} lignes)` : "Importer un CSV de ligne de liste (cas, dates, zone…)"}
        </p>
        <input ref={fileRef} type="file" accept=".csv" onChange={handleFile} className="hidden" />
      </div>

      {rows && numericCols.length > 0 && (
        <div className="bg-[#F6F2E6] border border-[#D8CFB8] rounded-sm p-3 h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rows}>
              <CartesianGrid stroke="#D8CFB8" strokeDasharray="3 3" />
              <XAxis dataKey={labelCol} tick={{ fontSize: 10, fill: "#5b5347" }} />
              <YAxis tick={{ fontSize: 10, fill: "#5b5347" }} />
              <Tooltip contentStyle={{ fontSize: 12, fontFamily: "IBM Plex Sans, sans-serif" }} />
              {numericCols.slice(0, 2).map((c, i) => (
                <Bar key={c} dataKey={c} fill={i === 0 ? "#B33F2E" : "#2F6E62"} radius={[2, 2, 0, 0]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="flex gap-2">
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Question précise (optionnel) : ex. quel type de courbe épidémique ?"
          className="flex-1 bg-[#F6F2E6] border border-[#D8CFB8] rounded-sm px-3 py-2 text-[14px] font-sans focus:outline-none focus:ring-2 focus:ring-[#2F6E62] placeholder:text-[#928a76]"
        />
        <button
          onClick={analyse}
          disabled={!rows || loading}
          className="bg-[#B33F2E] hover:bg-[#9c3527] disabled:opacity-40 text-[#EDE7D9] rounded-sm px-4 py-2 text-sm font-sans flex items-center gap-2"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <LineChartIcon className="w-4 h-4" />}
          Analyser
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-[#B33F2E] text-sm">
          <AlertTriangle className="w-4 h-4" /> {error}
        </div>
      )}

      {interpretation && (
        <div className="bg-[#F6F2E6] border border-[#D8CFB8] rounded-sm px-4 py-3 text-[14.5px] leading-relaxed whitespace-pre-wrap font-sans text-[#16211D]">
          {interpretation}
        </div>
      )}
    </div>
  );
}

export default function EpiAssistant() {
  const [active, setActive] = useState("cours");

  async function apiCall(system, history) {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system,
        messages: history.map((m) => ({ role: m.role, content: m.apiContent ?? m.content })),
      }),
    });
    if (!res.ok) throw new Error("API error");
    const data = await res.json();
    const text = (data.content || [])
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("\n");
    return text || "Pas de réponse — réessaie.";
  }

  const mode = MODES[active];

  return (
    <div className="w-full h-[700px] bg-[#EDE7D9] flex flex-col font-sans" style={{ fontFamily: "'IBM Plex Sans', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap');
      `}</style>

      <header className="border-b border-[#D8CFB8] px-6 pt-5 pb-3">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-[11px] tracking-[0.18em] uppercase text-[#2F6E62] font-medium">Assistant de terrain</p>
            <h1 className="text-[26px] leading-none text-[#16211D]" style={{ fontFamily: "'Fraunces', serif", fontWeight: 600 }}>
              Vigie
            </h1>
          </div>
          <div className="w-40 shrink-0 hidden sm:block">
            <EpiCurveSignature />
          </div>
        </div>
      </header>

      <nav className="flex border-b border-[#D8CFB8] px-6">
        {Object.values(MODES).map((m) => {
          const Icon = m.icon;
          const isActive = active === m.key;
          return (
            <button
              key={m.key}
              onClick={() => setActive(m.key)}
              className={`flex items-center gap-2 px-4 py-3 text-[13px] font-medium border-b-2 transition-colors ${
                isActive ? "border-[#B33F2E] text-[#16211D]" : "border-transparent text-[#928
