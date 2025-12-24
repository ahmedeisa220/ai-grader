import React, { useEffect, useMemo, useState } from 'react';
import {
  Plus,
  Trash2,
  Image as ImageIcon,
  CheckCircle,
  Send,
  Award,
  RefreshCw,
  AlertCircle,
  LogOut,
  Lock,
} from 'lucide-react';

const apiKey = import.meta.env.VITE_GEMINI_KEY || "";

// ====== بيانات الأدمن (زي ما طلبت) ======
const ADMIN_EMAIL = "ahmed";
const ADMIN_PASSWORD = "2008";
const LS_ADMIN_KEY = "ai_grader_is_admin";

// ====== Modal تسجيل الأدمن ======
function AdminLoginModal({ open, onClose, onLogin }) {
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    if (open) {
      setEmail("");
      setPass("");
      setErr("");
    }
  }, [open]);

  if (!open) return null;

  const submit = () => {
    setErr("");
    const ok = onLogin(email.trim(), pass);
    if (!ok) setErr("بيانات الأدمن غير صحيحة.");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/60"
        onClick={onClose}
      />
      <div className="relative w-[92%] max-w-md bg-white rounded-2xl border border-slate-200 shadow-2xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <div className="bg-indigo-600 p-2 rounded-lg">
            <Lock className="text-white w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-extrabold text-slate-900">دخول الأدمن</h3>
            <p className="text-sm text-slate-500">الدخول يسمح بإنشاء وتعديل الأسئلة فقط.</p>
          </div>
        </div>

        <div className="space-y-3">
          <div className="space-y-1">
            <label className="text-sm font-bold text-slate-600">Email</label>
            <input
              className="w-full p-3 bg-slate-50 rounded-xl outline-none border border-slate-200 focus:ring-2 focus:ring-indigo-500"
              placeholder="مثال: example@gmail.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-bold text-slate-600">Password</label>
            <input
              type="password"
              className="w-full p-3 bg-slate-50 rounded-xl outline-none border border-slate-200 focus:ring-2 focus:ring-indigo-500"
              placeholder="••••••"
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
            />
          </div>

          {err && (
            <div className="bg-red-50 text-red-700 p-3 rounded-xl flex items-center gap-2">
              <AlertCircle size={18} />
              <span className="text-sm font-semibold">{err}</span>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              onClick={submit}
              className="flex-1 bg-indigo-600 text-white py-3 rounded-xl font-extrabold hover:bg-indigo-700 transition"
            >
              دخول
            </button>
            <button
              onClick={onClose}
              className="flex-1 bg-white border border-slate-200 text-slate-700 py-3 rounded-xl font-extrabold hover:bg-slate-50 transition"
            >
              إلغاء
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const App = () => {
  const [view, setView] = useState('landing'); // landing, edit, take, results
  const [questions, setQuestions] = useState([]);
  const [studentAnswers, setStudentAnswers] = useState({});
  const [gradingResults, setGradingResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // ====== حالة الأدمن ======
  const [isAdmin, setIsAdmin] = useState(false);
  const [showAdminModal, setShowAdminModal] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(LS_ADMIN_KEY) === "1";
    setIsAdmin(saved);
  }, []);

  const loginAdmin = (email, pass) => {
    const ok = (email === ADMIN_EMAIL && pass === ADMIN_PASSWORD);
    if (ok) {
      setIsAdmin(true);
      localStorage.setItem(LS_ADMIN_KEY, "1");
      setShowAdminModal(false);
    }
    return ok;
  };

  const logoutAdmin = () => {
    setIsAdmin(false);
    localStorage.removeItem(LS_ADMIN_KEY);
    // لو كان واقف على edit نرجعه للـ landing
    if (view === "edit") setView("landing");
  };

  // منع الدخول لصفحة edit لو مش أدمن
  useEffect(() => {
    if (view === "edit" && !isAdmin) {
      setView("landing");
    }
  }, [view, isAdmin]);

  // دالة استدعاء AE Checker للتقييم
  const evaluateEssay = async (question, studentAnswer, modelAnswer, maxGrade) => {
    const systemPrompt = `أنت مصحح أكاديمي خبير. مهمتك هي تقييم إجابة الطالب بناءً على "الإجابة النموذجية" الملحقة. 
يجب أن تعطي درجة من ${maxGrade} بناءً على دقة وصحة المعلومات.
- إذا كانت الإجابة مطابقة تماماً، اعطه الدرجة كاملة.
- إذا كانت صحيحة لكن ينقصها بعض التفاصيل، اعطه درجة جزئية (مثلاً 4 من 5).
- إذا كانت خاطئة تماماً، اعطه صفر.
يجب أن يكون الرد بتنسيق JSON حصراً يحتوي على الحقول التالية:
- score: الدرجة الرقمية (number)
- feedback: تعليق قصير جداً باللغة العربية يوضح سبب الدرجة.`;

    const userQuery = `السؤال: ${question}
الإجابة النموذجية: ${modelAnswer}
إجابة الطالب: ${studentAnswer}
الدرجة القصوى: ${maxGrade}`;

    const payload = {
      contents: [{ parts: [{ text: userQuery }] }],
      systemInstruction: { parts: [{ text: systemPrompt }] },
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT",
          properties: {
            score: { type: "NUMBER" },
            feedback: { type: "STRING" }
          },
          required: ["score", "feedback"]
        }
      }
    };

    let retries = 0;
    const maxRetries = 5;

    while (retries < maxRetries) {
      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          }
        );

        if (!response.ok) throw new Error('API Error');
        const result = await response.json();
        return JSON.parse(result.candidates[0].content.parts[0].text);
      } catch (err) {
        retries++;
        if (retries === maxRetries) throw err;
        await new Promise(res => setTimeout(res, Math.pow(2, retries) * 1000));
      }
    }
  };

  const startGrading = async () => {
    setLoading(true);
    setError(null);
    let totalScore = 0;
    let maxTotal = 0;
    const detailedResults = [];

    try {
      for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        const studentAns = studentAnswers[i] || "";
        maxTotal += parseInt(q.grade);

        if (q.type === 'mcq') {
          const isCorrect = studentAns === q.correctAnswer;
          const score = isCorrect ? parseInt(q.grade) : 0;
          totalScore += score;
          detailedResults.push({
            question: q.text,
            score: score,
            maxGrade: q.grade,
            feedback: isCorrect ? "إجابة صحيحة" : `إجابة خاطئة، الإجابة الصحيحة هي: ${q.correctAnswer}`,
            type: 'mcq'
          });
        } else {
          const evaluation = await evaluateEssay(q.text, studentAns, q.modelAnswer, q.grade);
          totalScore += evaluation.score;
          detailedResults.push({
            question: q.text,
            score: evaluation.score,
            maxGrade: q.grade,
            feedback: evaluation.feedback,
            type: 'essay'
          });
        }
      }

      setGradingResults({ totalScore, maxTotal, details: detailedResults });
      setView('results');
    } catch (err) {
      setError("حدث خطأ أثناء التقييم. يرجى المحاولة مرة أخرى.");
    } finally {
      setLoading(false);
    }
  };

  const addQuestion = () => {
    setQuestions([...questions, {
      type: 'mcq',
      text: '',
      imageUrl: '',
      grade: 5,
      options: ['', '', '', ''],
      correctAnswer: '',
      modelAnswer: ''
    }]);
  };

  const removeQuestion = (index) => {
    setQuestions(questions.filter((_, i) => i !== index));
  };

  const updateQuestion = (index, field, value) => {
    const newQs = [...questions];
    newQs[index][field] = value;
    setQuestions(newQs);
  };

  const updateOption = (qIndex, oIndex, value) => {
    const newQs = [...questions];
    newQs[qIndex].options[oIndex] = value;
    setQuestions(newQs);
  };

  const canTakeQuiz = useMemo(() => questions.length > 0, [questions.length]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans rtl" dir="rtl">
      {/* Header */}
      <nav className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="bg-indigo-600 p-2 rounded-lg">
              <CheckCircle className="text-white w-6 h-6" />
            </div>
            <div className="flex flex-col">
              <h1 className="text-xl font-bold tracking-tight">AE Quiz Checker</h1>
              {isAdmin && <span className="text-xs font-extrabold text-indigo-600">وضع الأدمن مفعل</span>}
            </div>
          </div>

          <div className="flex items-center gap-3">
            {view !== 'landing' && (
              <button
                onClick={() => { setView('landing'); setStudentAnswers({}); setGradingResults(null); }}
                className="text-sm font-medium text-slate-500 hover:text-indigo-600 transition-colors"
              >
                الرئيسية
              </button>
            )}
            {isAdmin && (
              <button
                onClick={logoutAdmin}
                className="text-sm font-extrabold text-slate-600 hover:text-red-600 transition-colors flex items-center gap-2"
                title="تسجيل خروج الأدمن"
              >
                <LogOut size={16} />
                خروج
              </button>
            )}
          </div>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Landing Page */}
        {view === 'landing' && (
          <div className="text-center py-20">
            <h2 className="text-4xl font-extrabold mb-4">اختبارات ذكية بتقييم فوري</h2>
            <p className="text-slate-600 text-lg mb-8 max-w-2xl mx-auto">
              أنشئ اختبارات مقالية واختيارية، ودع AE Checker يتولى مهمة التصحيح الدقيق ومقارنة الإجابات بالنموذج.
            </p>

            <div className="flex gap-4 justify-center">
              {/* زر إنشاء اختبار يظهر للأدمن فقط */}
              {isAdmin && (
                <button
                  onClick={() => setView('edit')}
                  className="bg-indigo-600 text-white px-8 py-3 rounded-xl font-semibold shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all flex items-center gap-2"
                >
                  <Plus size={20} /> إنشاء/تعديل اختبار
                </button>
              )}

              {canTakeQuiz && (
                <button
                  onClick={() => setView('take')}
                  className="bg-white border border-slate-200 text-slate-700 px-8 py-3 rounded-xl font-semibold hover:bg-slate-50 transition-all flex items-center gap-2"
                >
                  <Send size={20} /> خوض الاختبار الحالي
                </button>
              )}
            </div>

            {!isAdmin && !canTakeQuiz && (
              <div className="mt-8 max-w-xl mx-auto bg-amber-50 text-amber-800 border border-amber-100 p-4 rounded-2xl">
                <div className="flex items-center justify-center gap-2 font-extrabold">
                  <AlertCircle size={18} />
                  لا يوجد اختبار جاهز حالياً
                </div>
                <p className="mt-2 text-sm font-semibold">
                  إنشاء الأسئلة متاح للأدمن فقط. اضغط زر A أسفل اليسار للدخول كأدمن.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Editor View (Admin only) */}
        {view === 'edit' && isAdmin && (
          <div className="space-y-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-2xl font-bold">بناء الاختبار</h3>
              <button
                onClick={addQuestion}
                className="bg-indigo-50 text-indigo-700 px-4 py-2 rounded-lg font-medium hover:bg-indigo-100 transition-colors flex items-center gap-2"
              >
                <Plus size={18} /> إضافة سؤال
              </button>
            </div>

            {questions.map((q, idx) => (
              <div key={idx} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm transition-all hover:shadow-md">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex gap-4">
                    <span className="bg-slate-100 text-slate-600 font-bold px-3 py-1 rounded-md">س {idx + 1}</span>
                    <select
                      value={q.type}
                      onChange={(e) => updateQuestion(idx, 'type', e.target.value)}
                      className="bg-slate-50 border-none text-sm font-semibold rounded-md focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="mcq">اختيار من متعدد</option>
                      <option value="essay">سؤال مقالي</option>
                    </select>
                  </div>
                  <button onClick={() => removeQuestion(idx)} className="text-red-400 hover:text-red-600">
                    <Trash2 size={20} />
                  </button>
                </div>

                <div className="space-y-4">
                  <textarea
                    placeholder="نص السؤال هنا..."
                    className="w-full p-4 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                    rows="2"
                    value={q.text}
                    onChange={(e) => updateQuestion(idx, 'text', e.target.value)}
                  />

                  <div className="flex gap-4 items-center">
                    <div className="flex-1 flex items-center gap-2 bg-slate-50 p-2 rounded-lg border border-dashed border-slate-300">
                      <ImageIcon size={20} className="text-slate-400" />
                      <input
                        type="text"
                        placeholder="رابط صورة السؤال (اختياري)"
                        className="bg-transparent border-none text-sm w-full outline-none"
                        value={q.imageUrl}
                        onChange={(e) => updateQuestion(idx, 'imageUrl', e.target.value)}
                      />
                    </div>
                    <div className="w-32 flex items-center gap-2 bg-slate-50 p-2 rounded-lg border border-slate-200">
                      <span className="text-xs font-bold text-slate-500">الدرجة:</span>
                      <input
                        type="number"
                        className="bg-transparent border-none text-sm w-full outline-none font-bold"
                        value={q.grade}
                        onChange={(e) => updateQuestion(idx, 'grade', e.target.value)}
                      />
                    </div>
                  </div>

                  {q.type === 'mcq' ? (
                    <div className="grid grid-cols-2 gap-3 mt-4">
                      {q.options.map((opt, oIdx) => (
                        <div key={oIdx} className="flex items-center gap-2">
                          <input
                            type="radio"
                            name={`correct-${idx}`}
                            checked={q.correctAnswer === opt && opt !== ''}
                            onChange={() => updateQuestion(idx, 'correctAnswer', opt)}
                            className="text-indigo-600"
                          />
                          <input
                            type="text"
                            placeholder={`خيار ${oIdx + 1}`}
                            className="bg-slate-50 p-2 rounded-lg border-none w-full text-sm"
                            value={opt}
                            onChange={(e) => updateOption(idx, oIdx, e.target.value)}
                          />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-4">
                      <label className="block text-sm font-bold text-slate-500 mb-2">الإجابة النموذجية (سيقارن AE Checker بها):</label>
                      <textarea
                        className="w-full p-4 bg-indigo-50/30 border border-indigo-100 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none italic"
                        rows="3"
                        placeholder="اكتب الإجابة الكاملة التي تتوقعها من الطالب..."
                        value={q.modelAnswer}
                        onChange={(e) => updateQuestion(idx, 'modelAnswer', e.target.value)}
                      />
                    </div>
                  )}
                </div>
              </div>
            ))}

            <div className="flex justify-center pt-8">
              <button
                onClick={() => setView('take')}
                className="bg-indigo-600 text-white px-12 py-4 rounded-2xl font-bold shadow-xl shadow-indigo-100 hover:scale-105 transition-transform disabled:opacity-50"
                disabled={!canTakeQuiz}
                title={!canTakeQuiz ? "أضف سؤال واحد على الأقل" : ""}
              >
                حفظ وبدء الاختبار
              </button>
            </div>
          </div>
        )}

        {/* Taking the Quiz View */}
        {view === 'take' && (
          <div className="max-w-2xl mx-auto space-y-8">
            <h3 className="text-2xl font-bold text-center mb-8">اختبار مادة (غير محدد)</h3>

            {!canTakeQuiz && (
              <div className="bg-amber-50 text-amber-800 border border-amber-100 p-4 rounded-2xl text-center font-semibold">
                لا يوجد اختبار جاهز حالياً.
              </div>
            )}

            {questions.map((q, idx) => (
              <div key={idx} className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
                <div className="flex justify-between items-start mb-6">
                  <span className="text-indigo-600 font-bold">السؤال {idx + 1}</span>
                  <span className="text-slate-400 text-sm font-medium">{q.grade} درجة</span>
                </div>

                <h4 className="text-xl font-semibold mb-4 leading-relaxed">{q.text}</h4>

                {q.imageUrl && (
                  <div className="mb-6 rounded-2xl overflow-hidden border">
                    <img
                      src={q.imageUrl}
                      alt="سؤال"
                      className="w-full h-auto object-cover max-h-64"
                      onError={(e) => { e.currentTarget.src = 'https://via.placeholder.com/600x300?text=Image+Error'; }}
                    />
                  </div>
                )}

                {q.type === 'mcq' ? (
                  <div className="space-y-3">
                    {q.options.map((opt, oIdx) => (
                      <label
                        key={oIdx}
                        className={`flex items-center p-4 rounded-xl border-2 cursor-pointer transition-all ${
                          studentAnswers[idx] === opt ? 'border-indigo-600 bg-indigo-50' : 'border-slate-50 bg-slate-50 hover:border-slate-200'
                        }`}
                      >
                        <input
                          type="radio"
                          className="hidden"
                          name={`ans-${idx}`}
                          onChange={() => setStudentAnswers({ ...studentAnswers, [idx]: opt })}
                        />
                        <span className={`w-6 h-6 rounded-full border-2 mr-3 flex items-center justify-center transition-all ${
                          studentAnswers[idx] === opt ? 'border-indigo-600 bg-indigo-600' : 'border-slate-300 bg-white'
                        }`}>
                          {studentAnswers[idx] === opt && <div className="w-2 h-2 bg-white rounded-full"></div>}
                        </span>
                        <span className="font-medium">{opt}</span>
                      </label>
                    ))}
                  </div>
                ) : (
                  <textarea
                    className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-indigo-500 focus:ring-0 outline-none transition-all"
                    rows="5"
                    placeholder="اكتب إجابتك هنا بوضوح..."
                    onChange={(e) => setStudentAnswers({ ...studentAnswers, [idx]: e.target.value })}
                  />
                )}
              </div>
            ))}

            <div className="flex justify-center pt-8">
              <button
                disabled={loading || !canTakeQuiz}
                onClick={startGrading}
                className="bg-indigo-600 text-white px-12 py-4 rounded-2xl font-bold shadow-xl shadow-indigo-100 flex items-center gap-3 disabled:opacity-50"
              >
                {loading ? <RefreshCw className="animate-spin" /> : <Send />}
                {loading ? "جاري التصحيح..." : "تسليم الإجابات للتصحيح"}
              </button>
            </div>

            {error && (
              <div className="bg-red-50 text-red-600 p-4 rounded-xl flex items-center gap-3 mt-4">
                <AlertCircle size={20} />
                <p className="text-sm font-medium">{error}</p>
              </div>
            )}
          </div>
        )}

        {/* Results View */}
        {view === 'results' && gradingResults && (
          <div className="max-w-2xl mx-auto space-y-8 animate-in fade-in zoom-in duration-500">
            <div className="bg-indigo-600 rounded-3xl p-10 text-white text-center shadow-2xl shadow-indigo-200">
              <Award className="w-16 h-16 mx-auto mb-4 text-indigo-200" />
              <h3 className="text-3xl font-extrabold mb-2">تم تصحيح اختبارك بنجاح!</h3>
              <div className="text-6xl font-black mb-4">
                {gradingResults.totalScore} <span className="text-2xl font-normal text-indigo-200">/ {gradingResults.maxTotal}</span>
              </div>
              <p className="text-indigo-100">
                لقد قمنا بتحليل إجاباتك باستخدام AE Quiz Checker ومقارنتها بالنماذج المطلوبة.
              </p>
            </div>

            <h4 className="text-xl font-bold">تفاصيل التقييم:</h4>

            <div className="space-y-4">
              {gradingResults.details.map((res, idx) => (
                <div key={idx} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-sm font-bold text-slate-400">س {idx + 1}</span>
                    <span className={`px-3 py-1 rounded-full text-xs font-black ${
                      res.score === parseInt(res.maxGrade) ? 'bg-green-100 text-green-700' :
                      res.score > 0 ? 'bg-orange-100 text-orange-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {res.score} من {res.maxGrade}
                    </span>
                  </div>
                  <p className="font-semibold text-slate-800 mb-3">{res.question}</p>
                  <div className="bg-slate-50 p-4 rounded-xl text-sm border-r-4 border-indigo-400">
                    <p className="text-slate-600 leading-relaxed font-medium">
                      <span className="font-bold text-indigo-600">تقييم المصحح الذكي:</span> {res.feedback}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-center pt-8">
              <button
                onClick={() => setView('landing')}
                className="text-indigo-600 font-bold hover:underline"
              >
                العودة للرئيسية
              </button>
            </div>
          </div>
        )}
      </main>

      {/* زر الأدمن A (Bottom-Left) */}
      <button
        onClick={() => (isAdmin ? logoutAdmin() : setShowAdminModal(true))}
        className="fixed bottom-6 left-6 z-40 w-12 h-12 rounded-full bg-slate-900 text-white font-black shadow-lg hover:scale-105 transition flex items-center justify-center"
        title={isAdmin ? "تسجيل خروج الأدمن" : "دخول الأدمن"}
      >
        A
      </button>

      <AdminLoginModal
        open={showAdminModal}
        onClose={() => setShowAdminModal(false)}
        onLogin={loginAdmin}
      />
    </div>
  );
};

export default App;
