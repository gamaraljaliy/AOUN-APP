# تشغيل عون لأول مرة

## ١. مستودع الفريق

المستودع المشترك هو gamaraljaliy/AOUN-APP. للبدء من جهاز جديد:

```bash
git clone https://github.com/gamaraljaliy/AOUN-APP.git
cd AOUN-APP
```

تضيف قمر الزميلات من Settings ثم Collaborators لمنحهن صلاحية الدفع إلى فروعهن. مجلد mobile وملفات supabase من مسؤولية قمر، ويتعاون فريق الباكند معها عبر العقد في docs/api.md.

## ٢. تجهيز Supabase مرة واحدة

أنشئي مشروعًا باسم aoun-dev من لوحة Supabase. احفظي كلمة مرور القاعدة محليًا. انسخي Project Ref من إعدادات المشروع. من جذر المستودع، بعد تثبيت Supabase CLI:
```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase db push --dry-run
supabase db push --include-seed
```
استخدمي include-seed عند تهيئة مشروع التطوير بالبيانات التجريبية. فعّلي Data API للمخطط public في إعدادات المشروع. من نافذة Connect أو API Keys، خذي Project URL والمفتاح publishable. احتفظي بكلمة مرور القاعدة ومفتاح service_role خارج المستودع. كل migration لاحقة لها ملف جديد وتُطبّق بعد مراجعة الـPR. لا يحتاج الجوال مفاتيح Supabase.

بديل محلي لمن عندها Docker وSupabase CLI: من جذر المشروع شغّلي `supabase start` لتهيئة القاعدة. يعرض `supabase status` الرابط والمفتاح المحليين. أمر `supabase db reset --local` يعيد إنشاء قاعدة التطوير المحلية ويحذف تعديلاتها غير المحفوظة.

## ٣. تشغيل الباكند على الماك

من جذر المستودع، باستخدام Python 3.12:
```bash
cd backend
python3.12 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
cp .env.example .env
```
ضعي القيمتين في backend/.env ثم شغّلي:
```bash
python -m unittest discover -s tests
python -m uvicorn main:app --reload --host 0.0.0.0
```
افتحي http://localhost:8000/docs واختبري GET /places بقيمة Mall. تظهر نتيجة الرياض بارك عند تحميل البيانات التجريبية. إذا ظهر 503 فتحققي من الرابط والمفتاح وتطبيق migration.

## ٤. تشغيل الجوال

من نافذة Terminal ثانية، ابدئي من جذر المستودع. استخدمي Node 22.13 أو أحدث من سلسلة 22.
```bash
cd mobile
npm ci
cp .env.example .env
npm run typecheck
npm start
```
لمحاكي iOS على الماك استخدمي 127.0.0.1. لمحاكي Android Studio استخدمي 10.0.2.2. للجوال الحقيقي اكتبي عنوان الماك على شبكة Wi-Fi بدل 127.0.0.1 في EXPO_PUBLIC_API_URL، مثل http://192.168.1.20:8000، ووصلي الجهازين بنفس الشبكة. أعيدي تشغيل Expo بعد تعديل الملف. اختاري محاكيًا مع عميل Expo متوافق مع SDK 54. اتصالات HTTP هنا للتطوير المحلي، وخادم الاختبار المنشور يحتاج HTTPS.

## ٥. تجربة مشتركة

ابحثي عن Mall واختاري المنحدر والمصعد، ثم افتحي الرياض بارك. يظهر تصنيف «مهيأ» بناء على بيانات تجريبية. جربي اسمًا لا يطابق أي مكان، ثم أوقفي الباكند وأعيديه لاختبار إعادة المحاولة. سجلي الجهاز والنتيجة في المهمة. بقياس مستقل على الجهاز اختبري قارئ الشاشة وتكبير النص وسرعة الاستجابة.
