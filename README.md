# سهمي (Sahmi)

تطبيق ويب شخصي لتحليل أسهم السوق السعودي (TASI) باستخدام بيانات **SAHMK API**
(باقة Starter)، مع نظام تقييم استثماري (Investment Score) وإرسال تنبيهات
عبر Telegram. التطبيق للاستخدام الشخصي فقط - حساب واحد، بدون تسجيل عام.

> ⚠️ **حالة المشروع الحالية:** المرحلتان 1 و2 جاهزتان (إعداد المشروع،
> Firebase Auth، SahmkService، اختبار الاتصال بشركة أرامكو 2222، وتحديث
> دليل الشركات + الأسعار بالجملة وتخزينها في Firestore).
> المراحل 3-8 (المالية، المؤشرات الفنية، التقييم، Telegram، الواجهات،
> الجدولة والنشر) ستُبنى تباعًا - راجع قسم "خارطة الطريق" أسفله.

---

## 1. لمحة عامة

| الطبقة | التقنية |
|---|---|
| Frontend | React + TypeScript + Vite + Tailwind CSS (RTL) |
| Backend | Firebase Cloud Functions (TypeScript) |
| قاعدة البيانات | Firestore |
| الجدولة | Firebase Scheduled Functions (Cloud Scheduler) |
| الاستضافة | Firebase Hosting |
| مصدر البيانات | [SAHMK API](https://www.sahmk.sa/en/developers) - باقة Starter |
| التنبيهات | Telegram Bot API |

باقة **SAHMK Starter ليست لحظية** ولا تدعم WebSocket أو Webhooks، لذلك
يعتمد النظام بالكامل على REST API + فحص مجدول (batch scanning) حسب
جدول زمني قابل للتعديل.

---

## 2. Endpoints الفعلية المستخدمة من SAHMK (باقة Starter)

Base URL: `https://app.sahmk.sa/api/v1` — Header: `X-API-Key`

| Endpoint | الاستخدام | الباقة المطلوبة |
|---|---|---|
| `GET /companies/` | دليل الشركات (بحث + pagination عبر limit/offset) | Free |
| `GET /company/{symbol}/` | بيانات شركة أساسية | Free+ |
| `GET /quotes/?symbols=...` | أسعار بالجملة (حتى 50 رمزًا بالطلب) | **Starter+** |
| `GET /quote/{symbol}/` | سعر فردي (احتياطي) | Free |
| `GET /historical/{symbol}/` | OHLCV يومي/أسبوعي/شهري (`1d`,`1w`,`1m` فقط) | **Starter+** |
| `GET /financials/{symbol}/` | قوائم الدخل/الميزانية/التدفقات النقدية | **Starter+** |
| `GET /analytics/ratios/{symbol}/` | نسب مالية لشركة واحدة | **Starter+** |
| `GET /analytics/compare/` | مقارنة نسب بين شركات (لمتوسط القطاع) | **Starter+** |
| `GET /dividends/{symbol}/` | سجل التوزيعات | **Starter+** |

**غير متاح في Starter ولن يُستخدم:** `GET /events/` (Pro+)، و WebSocket
`stream()` (Pro+، بث لحظي).

> ملاحظة أمانة: أسماء الحقول التفصيلية للاستجابات (خصوصًا historical/
> financials/dividends) غير موثقة علنًا بأمثلة JSON كاملة. لذلك بُنيت
> الـ TypeScript interfaces (`functions/src/services/sahmk/types.ts`)
> بشكل متسامح (`passthrough` + حقول اختيارية) ويتم حفظ الاستجابة الخام
> (raw response) في وضع التطوير فقط لمراجعتها وتثبيت الحقول الفعلية.

---

## 3. هيكل المشروع

```
Sahmi/
├── frontend/            React + TS + Vite (RTL)
├── functions/            Firebase Cloud Functions (TypeScript)
│   └── src/
│       ├── services/sahmk/     SahmkService + http client + cache + rate tracker + mappers
│       ├── services/telegram/  (قادم - المرحلة 6)
│       ├── scoring/            (قادم - المرحلة 5)
│       ├── technical/          (قادم - المرحلة 4)
│       ├── jobs/                منطق التحديث: refreshCompanies، refreshQuotes (batch + progress)
│       ├── repo/                طبقة الكتابة/القراءة من Firestore (companies, quotes)
│       ├── scheduled/          (قادم - المرحلة 8: تشغيل jobs/ على جدول)
│       ├── https/              دوال Callable (اختبار/فحص/تحديث يدوي)
│       ├── config/secrets.ts   تعريف Firebase Secrets
│       └── utils/              auth guard, rate limit, logger (يحجب الأسرار), batchRunner
├── firestore.rules
├── firestore.indexes.json
├── firebase.json
├── .env.example
└── README.md
```

> **Collections تشغيلية إضافية** غير مذكورة في المواصفة الأصلية لكن
> ضرورية للتشغيل الفعلي: `apiUsage` (عداد الاستخدام اليومي التقريبي)
> و`syncJobs` (تتبع تقدم كل عملية تحديث بالجملة - batch processing -
> حتى لا يوقف فشل سهم واحد بقية العملية، وليظهر التقدم لاحقًا في لوحة
> الإدارة).

---

## 4. التثبيت والتشغيل محليًا

### المتطلبات
- Node.js 20+
- حساب Firebase (Blaze plan مطلوب لتشغيل Cloud Functions خارجيًا مع Secrets، الاستخدام الفعلي سيبقى ضمن الحد المجاني تقريبًا لتطبيق شخصي)
- Firebase CLI: `npm install -g firebase-tools`
- مفتاح SAHMK API (باقة Starter)
- بوت Telegram (خطوات الإنشاء في القسم 7)

### خطوات التثبيت

```bash
# 1) تثبيت الاعتماديات
npm install --workspace frontend
npm install --workspace functions

# 2) تسجيل الدخول وربط مشروع Firebase
firebase login
firebase use --add           # اختر مشروعك أو أنشئ واحدًا جديدًا من Firebase Console
# عدّل .firebaserc ضع معرف مشروعك الحقيقي بدل REPLACE_WITH_YOUR_FIREBASE_PROJECT_ID

# 3) إعداد متغيرات الواجهة (frontend/.env.local)
cp frontend/.env.example frontend/.env.local
# املأ القيم من: Firebase Console > Project Settings > SDK setup and configuration
# أضف أيضًا: VITE_DEV_MODE=true (فقط أثناء التطوير)

# 4) تشغيل الواجهة محليًا
npm run dev:frontend

# 5) تشغيل Functions محليًا عبر المحاكي (Emulator)
firebase emulators:start --only functions,firestore,auth
```

### إعداد الأسرار الحقيقية (Backend فقط - لا تذهب أبدًا للـ Frontend)

```bash
firebase functions:secrets:set SAHMK_API_KEY
firebase functions:secrets:set TELEGRAM_BOT_TOKEN
firebase functions:secrets:set TELEGRAM_CHAT_ID
```

سيُطلب منك إدخال القيمة تفاعليًا (لا تُكتب في أي ملف). لتفعيل وضع
التطوير (لعرض Raw Response لمراجعة الحقول) عند التشغيل عبر المحاكي فقط:

```bash
# في functions/.env.local (لا يُرفع لأي مستودع - ضمن .gitignore)
DEV_MODE=true
```

اجعل `DEV_MODE=false` (أو احذف المتغير) قبل أي نشر للإنتاج.

---

## 5. أين أضع كل سر؟

| السر | أين يوضع | كيف يُقرأ |
|---|---|---|
| `SAHMK_API_KEY` | Firebase Secret (`firebase functions:secrets:set`) | `functions/src/config/secrets.ts` → `SAHMK_API_KEY.value()` داخل Functions فقط |
| `TELEGRAM_BOT_TOKEN` | Firebase Secret | نفس الطريقة، يُستخدم في TelegramService (Backend فقط) |
| `TELEGRAM_CHAT_ID` | Firebase Secret | نفس الطريقة |
| `VITE_FIREBASE_*` | `frontend/.env.local` | معرّفات Firebase العلنية فقط (ليست أسرارًا حساسة) |

**لا يوجد أي مفتاح API أو توكن Telegram في كود الـ Frontend أو في أي ملف
يُنشر للمتصفح.**

---

## 6. المصادقة (حساب واحد فقط)

التطبيق لا يحتوي شاشة "إنشاء حساب". لإنشاء الحساب الشخصي الوحيد:

1. من Firebase Console → Authentication → Sign-in method → فعّل "Email/Password".
2. من تبويب Users → Add user → أدخل بريدك وكلمة مرور قوية.
3. سجّل الدخول من صفحة `/login` في الواجهة بهذه البيانات.

كل دوال Functions (باستثناء الجدولة الداخلية) تتحقق من `request.auth`
وترفض أي طلب غير مصادَق (`unauthenticated`). قواعد Firestore
(`firestore.rules`) تمنع أيضًا أي قراءة/كتابة بدون تسجيل دخول، وتمنع كل
كتابة مباشرة من العميل على البيانات التشغيلية (تتم فقط من Functions عبر
Admin SDK).

---

## 7. إنشاء بوت Telegram والحصول على Chat ID

1. افتح محادثة مع [@BotFather](https://t.me/BotFather) على Telegram.
2. أرسل `/newbot` واتبع التعليمات (اسم البوت + username ينتهي بـ `bot`).
3. سيعطيك BotFather **التوكن** (شكل: `123456789:ABC-xyz...`) — هذا هو `TELEGRAM_BOT_TOKEN`.
4. ابدأ محادثة مع البوت الذي أنشأته (اضغط Start).
5. للحصول على `TELEGRAM_CHAT_ID` الخاص بك:
   - أرسل أي رسالة للبوت.
   - افتح في المتصفح: `https://api.telegram.org/bot<التوكن>/getUpdates`
   - ابحث عن `"chat":{"id": ...}` في الاستجابة — هذا الرقم هو `TELEGRAM_CHAT_ID`.
6. ضع القيمتين عبر `firebase functions:secrets:set` كما في القسم 5.

(زر "اختبار اتصال تيليجرام" في صفحة الإعدادات سيُبنى في المرحلة 6.)

---

## 8. حدود باقة SAHMK Starter (مهم)

- **لا بيانات لحظية**: لا WebSocket ولا Webhooks. كل تحديث يتم عبر طلب REST مجدول.
- **Bulk quotes بحد أقصى 50 رمزًا** لكل طلب `/quotes/` — يُقسَّم تلقائيًا في `SahmkService.getBulkQuotes`.
- **Historical محدود بفواصل `1d`/`1w`/`1m`** فقط (لا `30m`/`60m`، تلك لباقات أعلى).
- **لا `/events/` ولا `stream()`** (تحليل AI والبث اللحظي - Pro+ فقط).
- **لا سقف يومي/دقيقة منشور رسميًا لباقة Starter** بشكل رقمي دقيق في التوثيق العلني المتاح — لذلك يفرض التطبيق سقفًا احترازيًا داخليًا (5000 طلب/يوم تقريبًا، عداد `apiUsage` في Firestore) ويستخدم Bulk وCache لتقليل الاستهلاك.
- **Retry**: 3 محاولات، exponential backoff (0.5s, 1s, 2s)، فقط على أخطاء 429 و5xx.

---

## 9. خارطة الطريق (المراحل القادمة)

| المرحلة | المحتوى | الحالة |
|---|---|---|
| 1 | إعداد المشروع، Firebase Auth، SahmkService، اختبار شركة 2222 | ✅ جاهزة |
| 2 | قائمة الشركات + Bulk Quotes + تخزين Firestore | ✅ جاهزة |
| 3 | القوائم المالية + النسب + التوزيعات | ⏳ قادمة |
| 4 | OHLCV + المؤشرات الفنية (SMA/RSI) + Unit Tests | ⏳ قادمة |
| 5 | نظام Investment Score الكامل | ⏳ قادمة |
| 6 | تكامل Telegram والتنبيهات | ⏳ قادمة |
| 7 | واجهات التطبيق الكاملة (لوحة تحكم، مستكشف، صفحة سهم...) | ⏳ قادمة |
| 8 | الجدولة (Scheduled Functions) والنشر النهائي | ⏳ قادمة |

---

## 10. النشر على Firebase (سيُستكمل في المرحلة 8)

```bash
npm run build:frontend
npm run build:functions
firebase deploy --only hosting,functions,firestore:rules,firestore:indexes
```

---

## 11. Mock Data

لا يوجد أي Mock Data في الكود الحالي. أي بيانات تجريبية تُستخدم مستقبلًا
أثناء تطوير الواجهات (المرحلة 7) ستُعلَّم بوضوح بتعليق `// MOCK DATA -
DEV ONLY` وتُحذف قبل الدمج النهائي.

---

## 12. ترخيص واستخدام

مشروع شخصي غير مخصص للتوزيع العام. التنبيهات المرسلة عبر Telegram **ليست
توصية مالية** بأي شكل، وهي أدوات تحليل آلية فقط.
