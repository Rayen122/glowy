import type { Locale } from "@/core/domain/enums";

/**
 * Textes légaux (conditions d'utilisation, confidentialité — loi organique n° 2004-63) en FR / EN / AR.
 * À faire relire par un juriste et compléter (raison sociale, adresse, déclaration à l'INPDP) avant toute mise en ligne.
 */
export type LegalDoc = { title: string; updated: string; draft: string; sections: { heading: string; paragraphs: string[] }[] };

const UPDATED = { fr: "Mise à jour : 7 novembre 2026", en: "Last updated: 7 November 2026", ar: "آخر تحديث: 7 نوفمبر 2026" };
const DRAFT = {
  fr: "Version de travail du projet Glowy : ce texte doit être validé par un juriste et complété (identité de l'éditeur, déclaration à l'INPDP) avant une mise en ligne publique.",
  en: "Working version of the Glowy project: this text must be reviewed by a lawyer and completed (publisher identity, INPDP declaration) before any public launch.",
  ar: "نسخة عمل لمشروع Glowy: يجب أن يراجع هذا النص مختص قانوني وأن يُستكمل (هوية الناشر، التصريح لدى الهيئة الوطنية لحماية المعطيات الشخصية) قبل أي إطلاق للعموم.",
};

const TERMS: Record<Locale, LegalDoc> = {
  fr: {
    title: "Conditions d'utilisation",
    updated: UPDATED.fr,
    draft: DRAFT.fr,
    sections: [
      { heading: "1. Objet", paragraphs: ["Glowy met en relation des clientes et clients avec des salons de beauté vérifiés en Tunisie : recherche, réservation de rendez-vous, avis vérifiés et programme de fidélité. Les prestations sont réalisées par les salons, professionnels indépendants de Glowy."] },
      { heading: "2. Compte", paragraphs: ["La création d'un compte est gratuite. Vous vous engagez à fournir des informations exactes et à garder votre mot de passe confidentiel. Après 5 essais de mot de passe incorrects, le compte est bloqué 15 minutes.", "Un compte peut être suspendu en cas de fraude, d'abus (réservations fictives, avis mensongers) ou de non-respect des présentes conditions."] },
      { heading: "3. Réservations", paragraphs: ["Une réservation est d'abord une demande : le créneau vous est gardé et le salon la confirme ou la refuse. Vous êtes prévenu dans l'application et par e-mail. Une demande non confirmée avant l'heure du rendez-vous expire et l'acompte éventuel est remboursé.", "Vous pouvez avoir au plus 3 demandes en attente et jamais deux rendez-vous à la même heure."] },
      { heading: "4. Annulation et absence", paragraphs: ["Chaque salon fixe son délai d'annulation gratuite (24 h par défaut), affiché avant la confirmation. Une annulation plus tardive entraîne une pénalité de points et la conservation de l'acompte. Après l'heure du rendez-vous, l'annulation n'est plus possible : en cas d'absence constatée par le salon, l'acompte est conservé et 20 points sont retirés."] },
      { heading: "5. Paiement", paragraphs: ["Le paiement de l'acompte en ligne est actuellement en mode test : aucune donnée de carte n'est collectée ni stockée par Glowy. Le solde se règle au salon."] },
      { heading: "6. Avis vérifiés", paragraphs: ["Seule une personne ayant réservé peut laisser un avis, une fois par rendez-vous, à partir de l'heure du rendez-vous. Un avis lié à une absence est retiré. Les propos injurieux sont masqués automatiquement ; tout avis peut être signalé et modéré par l'équipe Glowy."] },
      { heading: "7. Programme de fidélité", paragraphs: ["Les points récompensent les visites, avis et actions prévues au barème affiché dans votre espace. Ils n'ont pas de valeur monétaire, ne sont pas cessibles et expirent après 12 mois sans activité. Les points accordés à tort (avis retiré, fraude) sont repris."] },
      { heading: "8. Responsabilité", paragraphs: ["Glowy vérifie les salons avant leur mise en ligne mais n'est pas partie au contrat de prestation entre vous et le salon. Les réclamations sur une prestation s'adressent d'abord au salon ; le support Glowy peut vous accompagner depuis votre espace."] },
      { heading: "9. Droit applicable", paragraphs: ["Les présentes conditions sont soumises au droit tunisien. Toute réclamation peut être adressée via la page Support de votre espace."] },
    ],
  },
  en: {
    title: "Terms of use",
    updated: UPDATED.en,
    draft: DRAFT.en,
    sections: [
      { heading: "1. Purpose", paragraphs: ["Glowy connects clients with verified beauty salons in Tunisia: search, appointment booking, verified reviews and a loyalty programme. Services are provided by the salons, which are independent from Glowy."] },
      { heading: "2. Account", paragraphs: ["Creating an account is free. You agree to provide accurate information and keep your password confidential. After 5 wrong password attempts, the account is locked for 15 minutes.", "An account may be suspended in case of fraud, abuse (fake bookings, misleading reviews) or breach of these terms."] },
      { heading: "3. Bookings", paragraphs: ["A booking is first a request: the slot is held for you and the salon confirms or declines it. You are notified in the app and by e-mail. A request not confirmed before the appointment time expires and any deposit is refunded.", "You can have at most 3 pending requests and never two appointments at the same time."] },
      { heading: "4. Cancellation and no-show", paragraphs: ["Each salon sets its free cancellation window (24 h by default), shown before you confirm. A later cancellation costs loyalty points and the deposit is kept. Once the appointment time has passed, it can no longer be cancelled: if the salon records a no-show, the deposit is kept and 20 points are deducted."] },
      { heading: "5. Payment", paragraphs: ["Online deposit payment currently runs in test mode: no card data is collected or stored by Glowy. The balance is paid at the salon."] },
      { heading: "6. Verified reviews", paragraphs: ["Only a person who booked can leave a review, once per appointment, from the appointment time. A review linked to a no-show is removed. Offensive words are masked automatically; any review can be reported and moderated by the Glowy team."] },
      { heading: "7. Loyalty programme", paragraphs: ["Points reward visits, reviews and the actions listed in the scale shown in your account. They have no cash value, cannot be transferred and expire after 12 months without activity. Points granted by mistake (removed review, fraud) are taken back."] },
      { heading: "8. Liability", paragraphs: ["Glowy checks salons before listing them but is not a party to the service contract between you and the salon. Complaints about a service go to the salon first; Glowy support can help you from your account."] },
      { heading: "9. Governing law", paragraphs: ["These terms are governed by Tunisian law. Any complaint can be sent through the Support page of your account."] },
    ],
  },
  ar: {
    title: "شروط الاستخدام",
    updated: UPDATED.ar,
    draft: DRAFT.ar,
    sections: [
      { heading: "1. الموضوع", paragraphs: ["تربط Glowy الحرفاء بصالونات تجميل موثّقة في تونس: البحث، حجز المواعيد، التقييمات الموثّقة وبرنامج الولاء. تُقدّم الخدمات من قبل الصالونات، وهي مستقلة عن Glowy."] },
      { heading: "2. الحساب", paragraphs: ["إنشاء الحساب مجاني. تلتزم بتقديم معلومات صحيحة وبالحفاظ على سرية كلمة المرور. بعد 5 محاولات خاطئة يُقفل الحساب لمدة 15 دقيقة.", "يمكن تعليق الحساب في حالة الاحتيال أو التجاوز (حجوزات وهمية، تقييمات كاذبة) أو عدم احترام هذه الشروط."] },
      { heading: "3. الحجوزات", paragraphs: ["الحجز هو أولًا طلب: يُحجز لك الموعد ويؤكده الصالون أو يرفضه، وتُعلَم بذلك في التطبيق وبالبريد الإلكتروني. الطلب غير المؤكَّد قبل وقت الموعد ينتهي ويُسترجع العربون إن وُجد.", "لا يمكن أن يكون لديك أكثر من 3 طلبات في الانتظار، ولا موعدان في الوقت نفسه."] },
      { heading: "4. الإلغاء والغياب", paragraphs: ["يحدد كل صالون مهلة الإلغاء المجاني (24 ساعة افتراضيًا)، وتظهر قبل التأكيد. الإلغاء المتأخر يُفقدك نقاطًا ويُحتفظ بالعربون. بعد وقت الموعد لا يمكن الإلغاء: إذا سجّل الصالون غيابك، يُحتفظ بالعربون وتُخصم 20 نقطة."] },
      { heading: "5. الدفع", paragraphs: ["دفع العربون عبر الإنترنت حاليًا في وضع تجريبي: لا تجمع Glowy ولا تحفظ أي بيانات بطاقة. يُدفع الباقي في الصالون."] },
      { heading: "6. التقييمات الموثّقة", paragraphs: ["لا يترك التقييم إلا من حجز، مرة واحدة لكل موعد، ابتداءً من وقت الموعد. يُسحب التقييم المرتبط بغياب. تُخفى الألفاظ المسيئة تلقائيًا، ويمكن الإبلاغ عن أي تقييم ومراجعته من فريق Glowy."] },
      { heading: "7. برنامج الولاء", paragraphs: ["تكافئ النقاط الزيارات والتقييمات والأعمال المذكورة في الجدول المعروض في حسابك. ليست لها قيمة نقدية ولا يمكن التنازل عنها، وتنتهي بعد 12 شهرًا دون نشاط. تُسترجع النقاط الممنوحة خطأً (تقييم مسحوب، احتيال)."] },
      { heading: "8. المسؤولية", paragraphs: ["تتحقق Glowy من الصالونات قبل نشرها، لكنها ليست طرفًا في عقد الخدمة بينك وبين الصالون. تُوجَّه الشكاوى حول خدمة ما إلى الصالون أولًا، ويمكن لفريق الدعم مرافقتك من حسابك."] },
      { heading: "9. القانون المنطبق", paragraphs: ["تخضع هذه الشروط للقانون التونسي. يمكن إرسال أي شكوى عبر صفحة الدعم في حسابك."] },
    ],
  },
};

const PRIVACY: Record<Locale, LegalDoc> = {
  fr: {
    title: "Politique de confidentialité",
    updated: UPDATED.fr,
    draft: DRAFT.fr,
    sections: [
      { heading: "1. Cadre", paragraphs: ["Glowy traite vos données personnelles conformément à la loi organique n° 2004-63 du 27 juillet 2004 portant sur la protection des données à caractère personnel. Vous disposez de droits sur vos données, détaillés ci-dessous."] },
      { heading: "2. Données collectées", paragraphs: ["Compte : nom, prénom, e-mail, mot de passe (chiffré, jamais lisible), et si vous les ajoutez téléphone, ville, date de naissance, photo.", "Utilisation : rendez-vous, avis, points de fidélité, salons favoris, messages au support et à l'assistante.", "Analyse beauté : la photo reste dans votre navigateur ; seules des mesures (luminosité, teintes) sont envoyées."] },
      { heading: "3. Finalités", paragraphs: ["Gérer votre compte et vos réservations, prévenir le salon concerné, vous envoyer rappels et notifications, calculer vos points, modérer les avis, recommander des salons, assurer la sécurité (blocage après des essais de connexion répétés, limitation des demandes)."] },
      { heading: "4. Destinataires", paragraphs: ["Le salon où vous réservez reçoit vos nom, téléphone et la note laissée pour le rendez-vous. Des prestataires techniques traitent certaines données pour notre compte : hébergement, envoi d'e-mails, et services d'IA pour la modération des avis et l'assistante (texte des messages uniquement). Vos données ne sont jamais vendues."] },
      { heading: "5. Durées de conservation", paragraphs: ["Compte : tant qu'il est actif, puis suppression ou anonymisation. Points : expirent après 12 mois sans activité. Factures : durée légale de conservation comptable. Journaux de sécurité : 12 mois."] },
      { heading: "6. Vos droits", paragraphs: ["Vous pouvez accéder à vos données, les rectifier depuis votre profil, vous opposer à un traitement ou demander la suppression de votre compte via la page Support. Vous pouvez également saisir l'Instance nationale de protection des données personnelles (INPDP)."] },
      { heading: "7. Sécurité et cookies", paragraphs: ["Mots de passe chiffrés (bcrypt), connexion protégée, sessions fermées après un changement de mot de passe. Les seuls cookies utilisés sont nécessaires au service : session de connexion et langue choisie. Aucun cookie publicitaire."] },
    ],
  },
  en: {
    title: "Privacy policy",
    updated: UPDATED.en,
    draft: DRAFT.en,
    sections: [
      { heading: "1. Framework", paragraphs: ["Glowy processes your personal data in accordance with Organic Law No. 2004-63 of 27 July 2004 on the protection of personal data. You have rights over your data, detailed below."] },
      { heading: "2. Data collected", paragraphs: ["Account: first and last name, e-mail, password (hashed, never readable), and if you add them phone, city, date of birth, photo.", "Usage: appointments, reviews, loyalty points, favourite salons, messages to support and to the assistant.", "Beauty analysis: the photo stays in your browser; only measurements (brightness, tones) are sent."] },
      { heading: "3. Purposes", paragraphs: ["Managing your account and bookings, notifying the salon concerned, sending reminders and notifications, computing your points, moderating reviews, recommending salons, ensuring security (lock after repeated login attempts, request limits)."] },
      { heading: "4. Recipients", paragraphs: ["The salon you book receives your name, phone number and the note left for the appointment. Technical providers process some data on our behalf: hosting, e-mail delivery, and AI services for review moderation and the assistant (message text only). Your data is never sold."] },
      { heading: "5. Retention", paragraphs: ["Account: while active, then deletion or anonymisation. Points: expire after 12 months without activity. Invoices: legal accounting retention period. Security logs: 12 months."] },
      { heading: "6. Your rights", paragraphs: ["You can access your data, correct it from your profile, object to processing or ask for your account to be deleted through the Support page. You may also contact the National Authority for Personal Data Protection (INPDP)."] },
      { heading: "7. Security and cookies", paragraphs: ["Hashed passwords (bcrypt), protected connection, sessions closed after a password change. The only cookies used are needed for the service: login session and chosen language. No advertising cookies."] },
    ],
  },
  ar: {
    title: "سياسة الخصوصية",
    updated: UPDATED.ar,
    draft: DRAFT.ar,
    sections: [
      { heading: "1. الإطار", paragraphs: ["تعالج Glowy معطياتك الشخصية طبقًا للقانون الأساسي عدد 63 لسنة 2004 المؤرخ في 27 جويلية 2004 المتعلق بحماية المعطيات الشخصية. لديك حقوق على معطياتك مفصّلة أدناه."] },
      { heading: "2. المعطيات المجمّعة", paragraphs: ["الحساب: الاسم واللقب والبريد الإلكتروني وكلمة المرور (مشفّرة، لا تُقرأ أبدًا)، وإن أضفتها: الهاتف، المدينة، تاريخ الولادة، الصورة.", "الاستعمال: المواعيد، التقييمات، نقاط الولاء، الصالونات المفضلة، الرسائل إلى الدعم وإلى المساعدة.", "تحليل الجمال: تبقى الصورة في متصفحك، ولا تُرسل إلا قياسات (الإضاءة، الألوان)."] },
      { heading: "3. الأغراض", paragraphs: ["إدارة حسابك وحجوزاتك، إعلام الصالون المعني، إرسال التذكيرات والإشعارات، احتساب نقاطك، مراجعة التقييمات، اقتراح الصالونات، وضمان الأمان (القفل بعد محاولات دخول متكررة، الحد من الطلبات)."] },
      { heading: "4. المتلقّون", paragraphs: ["يتلقى الصالون الذي تحجز فيه اسمك وهاتفك والملاحظة المتروكة للموعد. يعالج مزودون تقنيون بعض المعطيات لحسابنا: الاستضافة، إرسال البريد، وخدمات الذكاء الاصطناعي لمراجعة التقييمات والمساعدة (نص الرسائل فقط). لا تُباع معطياتك أبدًا."] },
      { heading: "5. مدة الحفظ", paragraphs: ["الحساب: طالما كان نشطًا ثم يُحذف أو يُجهَّل. النقاط: تنتهي بعد 12 شهرًا دون نشاط. الفواتير: المدة القانونية للحفظ المحاسبي. سجلات الأمان: 12 شهرًا."] },
      { heading: "6. حقوقك", paragraphs: ["يمكنك النفاذ إلى معطياتك وتصحيحها من ملفك الشخصي والاعتراض على معالجة ما أو طلب حذف حسابك عبر صفحة الدعم. يمكنك أيضًا الاتصال بالهيئة الوطنية لحماية المعطيات الشخصية."] },
      { heading: "7. الأمان وملفات تعريف الارتباط", paragraphs: ["كلمات مرور مشفّرة (bcrypt)، اتصال محمي، وإغلاق الجلسات بعد تغيير كلمة المرور. الملفات المستعملة ضرورية للخدمة فقط: جلسة الدخول واللغة المختارة. لا ملفات إعلانية."] },
    ],
  },
};

export const LEGAL = { conditions: TERMS, confidentialite: PRIVACY } as const;
export type LegalSlug = keyof typeof LEGAL;
