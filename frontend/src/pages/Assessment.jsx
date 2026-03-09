import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";
import Layout from "../components/Layout";
import "./assessment.css";

const DIAGNOSTIC_DURATION = 12 * 60;
const RETEST_DURATION = 8 * 60;

function formatTime(seconds) {
  const mins = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
  const secs = (seconds % 60).toString().padStart(2, "0");
  return `${mins}:${secs}`;
}

export default function Assessment() {
  const nav = useNavigate();
  const autoSubmittedRef = useRef(false);

  const [subjects, setSubjects] = useState([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState("");
  const [weakRows, setWeakRows] = useState([]);
  const [questionBankCount, setQuestionBankCount] = useState(0);
  const [lastAttempt, setLastAttempt] = useState(null);

  const [quiz, setQuiz] = useState(null);
  const [answers, setAnswers] = useState({});
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [timerLeft, setTimerLeft] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [result, setResult] = useState(null);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  const loadAssessmentData = async () => {
    try {
      const [subjectsRes, gapsRes, statusRes, historyRes] = await Promise.all([
        api.get("/api/subjects"),
        api.get("/api/gaps"),
        api.get("/api/assessments/status"),
        api.get("/api/assessments/history")
      ]);

      setSubjects(subjectsRes.data || []);
      setSelectedSubjectId((prev) => {
        if (prev) return prev;
        const first = (subjectsRes.data || [])[0];
        return first?.id ? String(first.id) : "";
      });

      const weakOnly = (gapsRes.data || []).filter(
        g => String(g.level).toLowerCase() === "weak"
      );

      setWeakRows(weakOnly);
      setQuestionBankCount(statusRes.data?.total_questions || 0);
      setLastAttempt((historyRes.data || [])[0] || null);
    } catch {
      setError("Failed to load assessment data");
    }
  };

  useEffect(() => {
    loadAssessmentData();
  }, []);

  const submitQuiz = async (isAuto = false) => {
    if (!quiz || isSubmitting) return;

    setIsSubmitting(true);

    try {
      const payload = {};

      quiz.questions.forEach(q => {
        payload[q.id] = answers[q.id] || null;
      });

      const res = await api.post("/api/assessments/submit", {
        subject_id: quiz.subject_id,
        topic: quiz.topic,
        mode: quiz.mode || "diagnostic",
        difficulty: "Mixed",
        answers: payload,
        auto_create_tasks: true
      });

      setResult(res.data);
      setQuiz(null);

      const created = Number(res.data?.tasks_created || 0);
      const weakCount = Number(res.data?.weak_topics?.length || 0);
      const submitLabel = isAuto ? "Auto submitted" : "Submitted successfully";
      setMsg(`${submitLabel}. Weak topics: ${weakCount}. Tasks created: ${created}.`);
      loadAssessmentData();
    } catch (err) {
      setError(err?.response?.data?.message || "Submit failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    if (!quiz || timerLeft <= 0) return;

    const id = setInterval(() => {
      setTimerLeft(prev => prev - 1);
    }, 1000);

    return () => clearInterval(id);
  }, [quiz, timerLeft]);

  useEffect(() => {
    if (!quiz || timerLeft > 0 || autoSubmittedRef.current) return;
    autoSubmittedRef.current = true;
    submitQuiz(true);
  }, [quiz, timerLeft]);

  const startDiagnostic = async () => {
    setError("");
    setMsg("");
    setResult(null);
    setAnswers({});
    setCurrentQuestionIndex(0);
    autoSubmittedRef.current = false;

    if (!subjects.length) {
      setError("No subjects found. Add a subject first.");
      return;
    }

    try {
      const subject = subjects.find((s) => String(s.id) === String(selectedSubjectId));
      if (!subject?.id) {
        setError("Please select a subject first.");
        return;
      }

      const res = await api.post("/api/assessments/start", {
        mode: "diagnostic",
        subject_id: subject.id
      });

      setQuiz(res.data);
      setTimerLeft(DIAGNOSTIC_DURATION);
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to start diagnostic");
    }
  };

  const startRetest = async (weakRow) => {
    setError("");
    setMsg("");
    setResult(null);
    setAnswers({});
    setCurrentQuestionIndex(0);
    autoSubmittedRef.current = false;

    try {
      const subjectId = Number(weakRow?.subject_id || 0);
      const topic = String(weakRow?.topic || "").trim();
      if (!subjectId || !topic) {
        setError("Invalid weak topic for retest.");
        return;
      }

      const res = await api.post("/api/assessments/start", {
        mode: "retest",
        subject_id: subjectId,
        topic
      });

      setQuiz(res.data);
      setTimerLeft(RETEST_DURATION);
      setMsg(`Retest started for: ${topic}`);
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to start retest");
    }
  };

  const onChoose = (qid, opt) => {
    setAnswers(prev => ({
      ...prev,
      [qid]: opt
    }));
  };

  const generatePlanNow = async () => {
    try {
      const res = await api.post("/api/gaps/generate-recovery-plan");
      setMsg(res.data?.message || "Plan generated");
    } catch {
      setError("Failed to generate plan");
    }
  };

  const questions = quiz?.questions || [];
  const current = questions[currentQuestionIndex];

  return (
    <Layout>
      <div className="asPage">
        <div className="asHeader">
          <div>
            <h1 className="asTitle">Assessment</h1>
            <p className="asSub">Start diagnostic, answer questions, and generate recovery tasks.</p>
          </div>
          <div className="asBankBadge">Question Bank: {questionBankCount}</div>
        </div>

        {msg && <div className="asAlert ok">{msg}</div>}
        {error && <div className="asAlert err">{error}</div>}

        <div className="asCard">
          <div className="asCardHead">
            <h2 className="asCardTitle">Diagnostic Test</h2>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <select
                className="asBtn"
                value={selectedSubjectId}
                onChange={(e) => setSelectedSubjectId(e.target.value)}
              >
                <option value="" disabled>
                  Select subject
                </option>
                {subjects.map((s) => (
                  <option key={s.id} value={String(s.id)}>
                    {s.name}
                  </option>
                ))}
              </select>
              <button className="asBtnPrimary" onClick={startDiagnostic}>
                Start Diagnostic
              </button>
            </div>
          </div>

          <div className="asMetaInfo">
            <div className="asMiniStat">Subjects: {subjects.length}</div>
            <div className="asMiniStat">Weak Topics: {weakRows.length}</div>
            <div className="asMiniStat">Last Attempt: {lastAttempt ? "Available" : "None"}</div>
            {quiz && <div className="asMiniStat">Time Left: {formatTime(Math.max(timerLeft, 0))}</div>}
          </div>
        </div>

        {quiz && current && (
          <div className="asExamShell" style={{ marginTop: 16 }}>
            <div className="asNavigator">
              {questions.map((q, i) => (
                <button
                  key={q.id}
                  className={`asNavQ ${answers[q.id] ? "answered" : ""} ${i === currentQuestionIndex ? "active" : ""}`}
                  onClick={() => setCurrentQuestionIndex(i)}
                >
                  {i + 1}
                </button>
              ))}
            </div>

            <div className="asQuestionCard">
              <p className="asQText">
                {currentQuestionIndex + 1}. {current.question}
              </p>

              <div className="asOptsGrid">
                {["A", "B", "C", "D"].map(k => (
                  <button
                    key={k}
                    className={`asOptBtn ${answers[current.id] === k ? "active" : ""}`}
                    onClick={() => onChoose(current.id, k)}
                  >
                    <span className="asOptKey">{k}</span>
                    <span>{current.options[k]}</span>
                  </button>
                ))}
              </div>

              <div className="asFooterNav">
                <button
                  className="asBtn"
                  onClick={() => setCurrentQuestionIndex(i => Math.max(0, i - 1))}
                  disabled={currentQuestionIndex === 0}
                >
                  Previous
                </button>

                {currentQuestionIndex < questions.length - 1 ? (
                  <button
                    className="asBtnPrimary"
                    onClick={() => setCurrentQuestionIndex(i => Math.min(questions.length - 1, i + 1))}
                  >
                    Next
                  </button>
                ) : (
                  <button className="asBtnPrimary" onClick={() => submitQuiz(false)} disabled={isSubmitting}>
                    {isSubmitting ? "Submitting..." : "Submit"}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {result && (
          <div className="asCard" style={{ marginTop: 16 }}>
            <h2 className="asCardTitle">Result</h2>
            <div className="asResultGrid" style={{ marginTop: 10 }}>
              <div className="asResultBox">
                <div className="label">Correct</div>
                <div className="value">{result.correct_count}</div>
              </div>
              <div className="asResultBox">
                <div className="label">Total</div>
                <div className="value">{result.total_questions}</div>
              </div>
              <div className="asResultBox">
                <div className="label">Percent</div>
                <div className="value">{result.score_percent}%</div>
              </div>
            </div>

            <div className="asFooterNav">
              <button className="asBtn" onClick={generatePlanNow}>
                Generate Plan
              </button>
              <button className="asBtnPrimary" onClick={() => nav("/tasks")}>
                Go To Tasks
              </button>
            </div>
          </div>
        )}

        {weakRows.length > 0 && (
          <div className="asWeakPanel">
            <h3 className="asCardTitle">Weak Topics</h3>
            {weakRows.slice(0, 5).map((w, idx) => (
              <div className="asWeakRow" key={`${w.subject_id || "s"}-${w.topic || "t"}-${idx}`}>
                <span>{w.topic || "Unknown Topic"}</span>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <span>{w.level || "weak"}</span>
                  <button className="asBtn" onClick={() => startRetest(w)}>
                    Retest
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
