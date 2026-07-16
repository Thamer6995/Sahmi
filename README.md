# سهمي (Sahmi)

تطبيق ويب شخصي لتحليل أسهم السوق السعودي (TASI) باستخدام بيانات **SAHMK API**
(باقة Starter)، مع نظام تقييم استثماري (Investment Score) وإرسال تنبيهات
عبر Telegram. التطبيق للاستخدام الشخصي فقط - حساب واحد، بدون تسجيل عام.

> ⚠️ **حالة المشروع الحالية:** كل المراحل الثمانية مكتملة معماريًا (خط
> جلب البيانات، Investment Score، Telegram، الواجهات الست، والجدولة).
> المشروع جاهز للنشر الفعلي بعد إعداد مفتاح SAHMK حقيقي، بوت Telegram،
> ونشر الخادم على Render (القسم 5) - راجع "خارطة الطريق" (القسم 10).

---

## 0. ⚠️ تنويه معماري مهم: لماذا الخادم على Render وليس Firebase Functions؟

الخطة الأصلية كانت استضافة كل الـ Backend على **Firebase Cloud
Functions**. أثناء النشر الفعلي، تبيّن أن ذلك يتطلب **خطة Blaze**
(الفوترة) إجباريًا - ليس بسبب التكلفة، بل لأن أي Cloud Function تتصل
بخدمة خارجية (SAHMK، Telegram) أو تعمل بجدولة تحتاج حساب فوترة مربوط
بالمشروع حتى لو كان الاستخدام الفعلي ضمن الحصة المجانية بالكامل.

**فوترة Google Cloud الشخصية (غير التجارية) غير متاحة حاليًا في السعودية**
إلا عبر شريك معتمد واحد (CNTXT)، وهو يقبل حاليًا حسابات **Business
(Google Workspace) فقط** - "Individual (non-business) onboarding is
temporarily unavailable" وقت كتابة هذا الملف.

**الحل المعتمد:** إبقاء كل ما هو مجاني تمامًا على Firebase (Firestore
+ Authentication + Hosting - لا تحتاج Blaze إطلاقًا)، ونقل منطق الخادم
فقط (SahmkService، التقييم، Telegram، الجدولة) إلى **Render.com** -
منصة استضافة مستقلة عن Google Cloud، مجانية، بدون قيود جغرافية أو
ريسيلر. الجدولة (Cron) تعمل الآن عبر **GitHub Actions** بدل Cloud
Scheduler، لنفس السبب.

**المنطق البرمجي (SahmkService، القوائم المالية، التقييم، Telegram،
الاستعلامات) لم يتغيّر إطلاقًا** - فقط طبقة النقل تغيّرت من Firebase
Callable Functions إلى مسارات Express عادية، والمصادقة انتقلت من سياق
`onCall` التلقائي إلى التحقق اليدوي من Firebase ID Token.

إن أصبحت فوترة KSA الشخصية متاحة لاحقًا، العودة لـ Cloud Functions
ممكنة لكنها ليست ضرورية - المعمارية الحالية تعمل بكامل الوظائف مجانًا.

---

## 1. لمحة عامة

| الطبقة | التقنية |
|---|---|
| Frontend | React + TypeScript + Vite + Tailwind CSS (RTL) |
| Backend | Express + TypeScript، مستضاف على **Render.com** |
| قاعدة البيانات | Firestore (Firebase - خطة Spark المجانية) |
| المصادقة | Firebase Authentication (حساب واحد، مجانية) |
| الجدولة | GitHub Actions (cron) يستدعي مسارات `/internal/*` على الخادم |
| الاستضافة (الواجهة) | Firebase Hosting (مجانية) |
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
> الـ TypeScript interfaces (`server/src/services/sahmk/types.ts`)
> بشكل متسامح (`passthrough` + حقول اختيارية) ويتم حفظ الاستجابة الخام
> (raw response) في وضع التطوير فقط لمراجعتها وتثبيت الحقول الفعلية.
>
> لنفس السبب، تحويل القوائم المالية والنسب (`mappers.ts` +
> `fieldPicker.ts`) يجرّب عدة أسماء حقول محتملة (مثل `net_income` أو
> `net_profit`) بدل افتراض اسم واحد، ويحتفظ بكل الحقول الأصلية دومًا في
> `rawMetrics` حتى لو لم نستطع تعيينها لحقل معروف - لا نفقد أي بيانات،
> ولا نخترع قيمة إن تعذّر الاستخراج (تظهر كـ "غير متوفرة" في التقييم لاحقًا).
>
> **حدود تقييم غير منصوص عليها رقميًا في الطلب الأصلي** (تركها الطلب
> مفتوحة بصيغة "حتى N نقاط" دون تحديد الحدود الداخلية) اتُّخذت فيها
> افتراضات معقولة وموثّقة داخل الكود مباشرة (`server/src/scoring/`):
> حدود CAGR لنمو الأرباح (15%/10%)، نطاقات P/B وEarnings Yield، وحدود نمو
> التوزيعات (95%/70%). عدّلها مباشرة في ملفات `quality.ts`/`valuation.ts`/
> `dividend.ts` إن رغبت في معايير مختلفة - الأوزان بين الأقسام الأربعة
> (35/25/25/15) نفسها قابلة للتعديل فعليًا من صفحة الإعدادات.

---

## 3. هيكل المشروع

```
Sahmi/
├── frontend/             React + TS + Vite (RTL) - يُنشر على Firebase Hosting
│   └── src/
│       ├── lib/backend.ts      يستدعي الخادم (Render) مع Firebase ID Token
│       ├── lib/firebase.ts     تهيئة Firebase (Auth + Firestore فقط - لا Functions)
│       ├── pages/               لوحة التحكم، مستكشف الأسهم، صفحة السهم، ...
│       └── components/
├── server/               Express + TS - يُنشر على Render.com (مستقل عن Google Cloud)
│   └── src/
│       ├── services/sahmk/     SahmkService + http client + cache + rate tracker + mappers
│       ├── services/telegram/  TelegramService + messageBuilder (بدون أي صيغة توصية شراء)
│       ├── scoring/            نظام Investment Score الكامل (quality/valuation/dividend/technical)
│       ├── alerts/             alertTier + evaluateAlert (قواعد التنبيه الستة والـ Cooldown)
│       ├── technical/          SMA/RSI/52-week + اختبارات وحدة
│       ├── jobs/                منطق التحديث والتقييم والتنبيه (batch + progress)
│       ├── repo/                طبقة الكتابة/القراءة من Firestore (كل الـ collections)
│       ├── scheduled/          دوال الفحص الدوري (تُستدعى من routes/internal.ts)
│       ├── routes/              api.ts (مسارات محمية بمصادقة المستخدم) + internal.ts (محمية بسر cron)
│       ├── middleware/          auth.ts (تحقق Firebase ID Token)، cronAuth.ts، errorHandler.ts
│       ├── config/               env.ts (متغيرات البيئة) + firebaseAdmin.ts (تهيئة Admin SDK)
│       └── utils/                logger (يحجب الأسرار)، rateLimit، batchRunner، validate
├── .github/workflows/scheduled-scans.yml   جدولة Cron عبر GitHub Actions (بديل Cloud Scheduler)
├── render.yaml            تعريف خدمة Render (Blueprint) لتسهيل النشر
├── firestore.rules
├── firestore.indexes.json
├── firebase.json          Hosting + Firestore فقط (لا قسم functions بعد الآن)
├── .env.example
└── README.md
```

> **Collections تشغيلية إضافية** غير مذكورة في المواصفة الأصلية لكن
> ضرورية للتشغيل الفعلي: `apiUsage` (عداد الاستخدام اليومي التقريبي)،
> `syncJobs` (تتبع تقدم كل عملية تحديث بالجملة)، و`_scheduleState`
> (يمنع تكرار تنفيذ الفحص اليومي رغم استدعاء GitHub Actions كل 30 دقيقة).
>
> **إعدادات Backend الافتراضية** (قبل تعديلها من صفحة `/settings`):
> `minimumAlertScore=80`، `alertCooldownDays=7`، `telegramEnabled=true`
> (`server/src/repo/settingsRepo.ts`) - تُقرأ من مستند `settings/app`
> إن وُجد، وإلا تُستخدم هذه القيم الافتراضية. حقل `alerts.telegramMessageId`
> إضافة تُلبّي متطلب "تسجيل Telegram message ID إن أمكن".

---

## 4. التثبيت والتشغيل محليًا

### المتطلبات
- Node.js 20+
- حساب Firebase (خطة Spark المجانية تكفي تمامًا - لا حاجة لـ Blaze)
- حساب [Render.com](https://render.com) (مجاني) لاستضافة الخادم
- حساب GitHub (لتشغيل جدولة Cron المجانية عبر Actions)
- Firebase CLI: `npm install -g firebase-tools` (للـ Hosting/Firestore فقط)
- مفتاح SAHMK API (باقة Starter)
- بوت Telegram (خطوات الإنشاء في القسم 7)

### خطوات التثبيت

```bash
# 1) تثبيت الاعتماديات
npm install --workspace frontend
npm install --workspace server

# 2) تسجيل الدخول وربط مشروع Firebase (Hosting/Firestore/Auth فقط)
firebase login
firebase use --add
# عدّل .firebaserc ضع معرف مشروعك الحقيقي

# 3) إعداد متغيرات الواجهة (frontend/.env.local)
cp frontend/.env.example frontend/.env.local
# املأ قيم Firebase من: Project Settings > SDK setup and configuration
# VITE_BACKEND_URL=http://localhost:8080 (أثناء التطوير المحلي)

# 4) إعداد متغيرات الخادم (server/.env)
cp server/.env.example server/.env
# املأ SAHMK_API_KEY, TELEGRAM_BOT_TOKEN/CHAT_ID, CRON_SECRET (أي قيمة عشوائية طويلة)
# ولّد FIREBASE_SERVICE_ACCOUNT_BASE64 كما في القسم 5

# 5) تشغيل الواجهة والخادم محليًا (في نافذتي طرفية منفصلتين)
npm run dev:frontend
npm run build --workspace server && node server/lib/index.js
# أو أثناء التطوير: npm run dev --workspace server (يعيد البناء تلقائيًا عند التعديل)

# 6) تشغيل اختبارات الوحدة (المؤشرات الفنية + التقييم + التنبيهات)
npm run test:server
```

---

## 5. إعداد الخادم (Render) وأين أضع كل سر

### أ. توليد مفتاح خدمة Firebase (Service Account)

الخادم يحتاج صلاحية الوصول لـ Firestore وFirebase Auth من خارج بيئة
Google Cloud، عبر حساب خدمة:

1. Firebase Console → ⚙️ Project Settings → تبويب **Service Accounts**
2. اضغط **Generate new private key** → يُنزَّل ملف JSON
3. حوّله إلى Base64 (لوضعه كمتغيّر بيئة واحد بدل رفع ملف):
   ```bash
   base64 -w0 service-account.json
   ```
4. احتفظ بالناتج - هذا هو `FIREBASE_SERVICE_ACCOUNT_BASE64`

### ب. نشر الخادم على Render

1. ادفع الكود لمستودع GitHub (إن لم يكن موجودًا هناك أصلًا)
2. من [render.com](https://dashboard.render.com) → **New** → **Web Service**
3. اربط المستودع - Render سيكتشف `render.yaml` تلقائيًا (Root Directory: `server`)
4. من تبويب **Environment**، املأ المتغيرات المطلوبة (راجع `server/.env.example`):

| المتغيّر | القيمة |
|---|---|
| `FIREBASE_SERVICE_ACCOUNT_BASE64` | الناتج من الخطوة (أ) |
| `SAHMK_API_KEY` | مفتاحك من SAHMK |
| `TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID` | من القسم 7 |
| `CRON_SECRET` | قيمة عشوائية طويلة تولّدها بنفسك، مثل: `openssl rand -hex 32` |
| `FRONTEND_ORIGIN` | رابط Firebase Hosting (مثال: `https://sahmi-e3e49.web.app`) |
| `APP_URL` | نفس رابط Hosting (لبناء زر Telegram) |

5. اضغط **Deploy** - بعد النجاح ستحصل على رابط مثل `https://sahmi-server.onrender.com`
6. ضع هذا الرابط في `frontend/.env.local` (`VITE_BACKEND_URL`) وأعد بناء ونشر الواجهة (القسم 11)

> **ملاحظة عن الخطة المجانية في Render:** الخدمة المجانية "تنام" بعد
> ~15 دقيقة من عدم الاستخدام، ويأخذ أول طلب بعدها ~30-50 ثانية
> للاستيقاظ. جدولة GitHub Actions (كل 30 دقيقة) تُبقيها نشطة تلقائيًا
> تقريبًا معظم الوقت، وأي تأخير بسيط في طلب يدوي من الواجهة غير ضار
> لتطبيق شخصي.

### جدول الأسرار الكامل

| السر | أين يوضع | ملاحظة |
|---|---|---|
| `SAHMK_API_KEY` | Render → Environment | لا يصل الواجهة أبدًا |
| `TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID` | Render → Environment | نفس الشيء |
| `FIREBASE_SERVICE_ACCOUNT_BASE64` | Render → Environment | صلاحية كاملة على المشروع - لا تُشارك |
| `CRON_SECRET` | Render → Environment **و** GitHub → Settings → Secrets and variables → Actions | نفس القيمة في المكانين |
| `RENDER_APP_URL` | GitHub → Settings → Secrets and variables → Actions → **Variables** | رابط الخادم (ليس سرًا، لكنه متغيّر بيئة للـ workflow) |
| `VITE_FIREBASE_*` | `frontend/.env.local` | معرّفات Firebase العلنية (ليست حساسة) |
| `VITE_BACKEND_URL` | `frontend/.env.local` | رابط خادم Render |

**لا يوجد أي مفتاح API أو توكن Telegram في كود الـ Frontend أو في أي ملف
يُنشر للمتصفح.**

---

## 6. المصادقة (حساب واحد فقط)

التطبيق لا يحتوي شاشة "إنشاء حساب". لإنشاء الحساب الشخصي الوحيد:

1. من Firebase Console → Authentication → Sign-in method → فعّل "Email/Password".
2. من تبويب Users → Add user → أدخل بريدك وكلمة مرور قوية.
3. سجّل الدخول من صفحة `/login` في الواجهة بهذه البيانات.

الواجهة ترسل Firebase ID Token مع كل طلب للخادم (`Authorization: Bearer
<token>`)، والخادم يتحقق منه عبر `firebase-admin/auth` قبل تنفيذ أي
مسار (`server/src/middleware/auth.ts`). قواعد Firestore
(`firestore.rules`) تمنع أيضًا أي قراءة/كتابة مباشرة بدون تسجيل دخول،
وتمنع كل كتابة مباشرة من العميل على البيانات التشغيلية (تتم فقط من
الخادم عبر Admin SDK).

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
6. ضع القيمتين في متغيرات بيئة Render (القسم 5).
7. بعد النشر، اضغط زر "اختبار اتصال تيليجرام" من صفحة الإعدادات (`/settings`) للتأكد من نجاح الربط.

---

## 8. حدود باقة SAHMK Starter (مهم)

- **لا بيانات لحظية**: لا WebSocket ولا Webhooks. كل تحديث يتم عبر طلب REST مجدول.
- **Bulk quotes بحد أقصى 50 رمزًا** لكل طلب `/quotes/` — يُقسَّم تلقائيًا في `SahmkService.getBulkQuotes`.
- **Historical محدود بفواصل `1d`/`1w`/`1m`** فقط (لا `30m`/`60m`، تلك لباقات أعلى).
- **لا `/events/` ولا `stream()`** (تحليل AI والبث اللحظي - Pro+ فقط).
- **لا سقف يومي/دقيقة منشور رسميًا لباقة Starter** بشكل رقمي دقيق في التوثيق العلني المتاح — لذلك يفرض التطبيق سقفًا احترازيًا داخليًا (5000 طلب/يوم تقريبًا، عداد `apiUsage` في Firestore) ويستخدم Bulk وCache لتقليل الاستهلاك.
- **Retry**: 3 محاولات، exponential backoff (0.5s, 1s, 2s)، فقط على أخطاء 429 و5xx.

---

## 9. صفحات الواجهة

| المسار | الصفحة | الملاحظات |
|---|---|---|
| `/` | لوحة التحكم | إحصاءات، أفضل 10 أسهم، آخر التنبيهات، استهلاك API، اختبار Telegram فوري |
| `/explorer` | مستكشف الأسهم | بحث/فلاتر (قطاع، تقييم، Dividend Yield، P/E، ROE، D/E) وترتيب قابل للنقر على كل عمود |
| `/stocks/:symbol` | صفحة السهم | التقييم الكامل، شارت يومي (SVG بدون مكتبات خارجية)، النسب، المالية، التوزيعات، سجل التقييم والتنبيهات، زر تحديث يدوي |
| `/watchlist` | قائمة المراقبة | إضافة/حذف، ملاحظات شخصية، سعر مستهدف - قراءة/كتابة مباشرة من العميل (بيانات شخصية لا تحتاج تحققًا من الخادم) |
| `/dividends` | تقويم التوزيعات | فلترة حسب الشهر والقطاع، الأيام المتبقية |
| `/settings` | الإعدادات | أوزان التقييم (تُطبَّق فعليًا عبر إعادة توزين النقاط - انظر `investmentScore.ts`)، الحد الأدنى للتنبيه، Cooldown، وقت الفحص، تفعيل Telegram، القطاعات المستبعدة، أزرار تحديث/فحص/اختبار |

كل الصفحات تقرأ من Firestore مباشرة (`onSnapshot`/`getDocs`) بعد تسجيل الدخول - لا Mock Data في أي مكان. صفحة `/dev-test` (أزرار اختبار كل مرحلة) لا تظهر إلا إذا `VITE_DEV_MODE=true`، ويجب إبقاؤها `false` في بناء الإنتاج.

> ملاحظة بناء: حجم حزمة JS النهائية ~670KB (غير مضغوطة) - أعلى من التحذير الافتراضي لـ Vite (500KB)، لكنه غير مهم عمليًا لتطبيق شخصي بحساب واحد؛ لم يُضَف أي تقسيم كود (code-splitting) تجنبًا لتعقيد غير ضروري.

---

## 10. خارطة الطريق (المراحل)

| المرحلة | المحتوى | الحالة |
|---|---|---|
| 1 | إعداد المشروع، Firebase Auth، SahmkService، اختبار شركة 2222 | ✅ جاهزة |
| 2 | قائمة الشركات + Bulk Quotes + تخزين Firestore | ✅ جاهزة |
| 3 | القوائم المالية + النسب + التوزيعات | ✅ جاهزة |
| 4 | OHLCV + المؤشرات الفنية (SMA/RSI) + Unit Tests | ✅ جاهزة |
| 5 | نظام Investment Score الكامل | ✅ جاهزة |
| 6 | تكامل Telegram والتنبيهات | ✅ جاهزة |
| 7 | واجهات التطبيق الكاملة (لوحة تحكم، مستكشف، صفحة سهم...) | ✅ جاهزة |
| 8 | الجدولة (GitHub Actions بدل Cloud Scheduler) والنشر | ✅ جاهزة |

كل المراحل الثمانية مكتملة معماريًا. المتبقي فعليًا: نشر الخادم على
Render بمفتاح SAHMK وبوت Telegram حقيقيين (القسم 5).

---

## 11. الجدولة (GitHub Actions بدل Cloud Scheduler)

| المسار الداخلي | الجدول (UTC) | ما يعادله بتوقيت الرياض | الوصف |
|---|---|---|---|
| `/internal/daily-scan` | كل 30 دقيقة (`3,33 * * * *`) | يُنفَّذ فعليًا مرة واحدة يوميًا | يقارن الوقت الحالي بتوقيت الرياض مع `settings.scanSchedule` (افتراضيًا `17:30`)؛ عند بلوغه: تحديث الأسعار بالجملة + OHLCV التزايدي + حساب التقييم وتطبيق التنبيهات |
| `/internal/weekly-financials` | الأحد `0 0 * * 0` | الأحد 3:00 صباحًا | تحديث دليل الشركات ثم القوائم المالية والنسب |
| `/internal/daily-dividends` | يوميًا `0 1 * * *` | 4:00 صباحًا | تحديث سجل التوزيعات |

الملف: `.github/workflows/scheduled-scans.yml`. كل الطلبات محمية بـ
`X-Cron-Secret` (نفس قيمة `CRON_SECRET` في Render).

**لماذا "كل 30 دقيقة" وليس جدولًا ثابتًا لفحص الأسعار؟** لأن جدولة أي
منصة (GitHub Actions أو Cloud Scheduler) تحتاج تعبير cron ثابتًا يُحدَّد
في ملف، بينما المطلوب أن "وقت الفحص" يبقى قابلًا للتعديل فعليًا من صفحة
الإعدادات دون تعديل أي ملف. الحل: استدعاء خفيف كل 30 دقيقة يتحقق فقط
"هل حان الوقت المضبوط ولم يُنفَّذ الفحص اليوم بعد؟" (`_scheduleState` في
Firestore) - التنفيذ الفعلي (وكل استهلاك SAHMK API) يحدث مرة واحدة فقط
يوميًا. القوائم المالية والتوزيعات لم تُطلب كأوقات قابلة للتعديل، فاستُخدم
جدول ثابت مباشرة.

**إعداد GitHub Actions:** من إعدادات المستودع → **Settings → Secrets
and variables → Actions**:
- تبويب **Variables**: أضف `RENDER_APP_URL` = رابط خادمك على Render
- تبويب **Secrets**: أضف `CRON_SECRET` = نفس القيمة المضبوطة في Render

يمكن تشغيل الجدولة يدويًا للاختبار من تبويب **Actions** في GitHub
(`workflow_dispatch`) بدل انتظار الموعد.

---

## 12. النشر الكامل

### أ. الخادم (Render) - انظر القسم 5 بالتفصيل

### ب. الواجهة (Firebase Hosting)

```bash
npm install --workspace frontend
# تأكد أن frontend/.env.local يحتوي VITE_BACKEND_URL برابط Render الفعلي
npm run build:frontend
firebase deploy --only hosting,firestore:rules,firestore:indexes
```

### ج. الجدولة (GitHub Actions) - انظر القسم 11

### د. بعد أول نشر كامل

1. أنشئ حساب المصادقة الوحيد (القسم 6)
2. سجّل دخول → من `/settings` اضغط **"تحديث يدوي"** (أول تعبئة لدليل الشركات والأسعار)
3. اضغط **"اختبار اتصال تيليجرام"** للتأكد من الربط
4. الفحص المجدول سيبدأ تلقائيًا حسب جدول GitHub Actions (القسم 11)

---

## 13. Mock Data

لا يوجد أي Mock Data في الكود النهائي المُسلَّم. كل البيانات المعروضة في
الواجهة تُقرأ من Firestore الفعلي بعد تعبئته عبر SahmkService.

---

## 14. ترخيص واستخدام

مشروع شخصي غير مخصص للتوزيع العام. التنبيهات المرسلة عبر Telegram **ليست
توصية مالية** بأي شكل، وهي أدوات تحليل آلية فقط.
