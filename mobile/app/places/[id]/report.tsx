import { useEffect, useState, useSyncExternalStore } from "react";
import { ActivityIndicator, View } from "react-native";
import type { Session } from "@supabase/supabase-js";
import { useAuth } from "../../../auth/context";
import {
  findSubmittedReport, getReportPlace, isReportIssue, latestReportId, reportIssues,
  submitReport, validReportPlace,
  type IssueType, type ReportPlace,
} from "../../../services/reports";
import { useDemo } from "../../../ui/demo";
import { usePlaceTarget } from "../../../ui/placeTarget";
import { useReportSubmissions } from "../../../ui/ReportsProvider";
import {
  Btn, C, Icon, Card, Chip, Field, FieldError, Message, S, Shell, T, Title,
  go, replace, useCopy,
} from "../../../ui/components";

export default function Report() {
  const { session, profile, loading, error } = useAuth();
  const { id, live, place } = usePlaceTarget();
  const placeId = Number(id);

  return (
    <Shell title="الإبلاغ عن مشكلة">
      {!validReportPlace(placeId) ? (
        <UnavailablePlace />
      ) : !session ? (
        loading
          ? <ActivityIndicator />
          : <Btn label="تسجيل الدخول" onPress={() => go("/login")} />
      ) : (
        <ReportForm
          key={session.user.id + ":" + placeId + ":" + (live ? "live" : place?.name ?? "")}
          session={session}
          placeId={placeId}
          legacyName={live ? undefined : place?.name ?? ""}
          canSubmit={!loading && profile?.id === session.user.id &&
            profile.role === "member" && profile.status === "active"}
          authLoading={loading}
          authError={error}
        />
      )}
    </Shell>
  );
}

function UnavailablePlace() {
  return (
    <>
      <Message text="تعذّر العثور على هذا المكان في الدليل. اختاري مكانًا من البحث لإرسال بلاغ." />
      <Btn label="البحث عن مكان" onPress={() => go("/search")} />
    </>
  );
}

const subscribeIdle = () => () => {};
const getIdle = () => "editing" as const;

function ReportForm({
  session, placeId, legacyName, canSubmit, authLoading, authError,
}: {
  session: Session;
  placeId: number;
  legacyName?: string;
  canSubmit: boolean;
  authLoading: boolean;
  authError: string;
}) {
  const { lang } = useDemo();
  const tr = useCopy();
  const [kind, setKind] = useState<IssueType | "">("");
  const [text, setText] = useState("");
  const [attempted, setAttempted] = useState(false);
  const submissions = useReportSubmissions();
  const [attempt, setAttempt] = useState(0);
  const [lookup, setLookup] = useState<
    { place: ReportPlace | null } | { error: true } | null
  >(null);

  const matchedPlace = lookup && "place" in lookup ? lookup.place : null;
  const submission = matchedPlace
    ? submissions.forPlace(session.user.id, matchedPlace.id)
    : null;
  const getState = submission?.getSnapshot ?? getIdle;
  const state = useSyncExternalStore(submission?.subscribe ?? subscribeIdle, getState, getState);

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    setLookup(null);
    getReportPlace(placeId, legacyName, signal).then((place) => {
      if (!signal.aborted) setLookup({ place });
    }).catch(() => {
      if (!signal.aborted) setLookup({ error: true });
    });
    return () => controller.abort();
  }, [placeId, legacyName, attempt]);

  if (!canSubmit && !authLoading) {
    return <Message text={authError || "إرسال البلاغات متاح للأعضاء النشطين."} />;
  }
  if (!lookup) return <ActivityIndicator accessibilityLabel={tr("جارٍ تحميل تفاصيل المكان")} />;
  if ("error" in lookup) {
    return (
      <>
        <Message text="تعذّر تحميل تفاصيل المكان." />
        <Btn label="إعادة المحاولة" onPress={() => setAttempt((value) => value + 1)} />
      </>
    );
  }
  if (!lookup.place || !submission) return <UnavailablePlace />;

  const place = lookup.place;
  const details = "/live-places/" + place.id;
  if (state === "submitted") {
    return (
      <Card>
        <Title>تم إرسال البلاغ</Title>
        <T>يمكن للمسؤول مراجعة البلاغ.</T>
        <Btn label="العودة إلى المكان" onPress={() => replace(details)} />
        <Btn
          label="الإبلاغ عن مشكلة أخرى"
          kind="soft"
          disabled={!canSubmit}
          onPress={() => {
            setKind("");
            setText("");
            setAttempted(false);
            submission.startNew();
          }}
        />
      </Card>
    );
  }

  const editable = state === "editing" || state === "rejected";

  function send() {
    if (!isReportIssue(kind) || !text.trim()) {
      setAttempted(true);
      return;
    }
    if (!submission) return;
    void submission.submit(
      { userId: session.user.id, activeMember: canSubmit },
      { issue: kind, description: text },
      () => latestReportId(session, place.id),
      ({ issue, description }) => submitReport(session, place.id, issue, description),
    );
  }

  return (
    <>
      <Card>
        <Title>{lang === "ar" ? place.name_ar : place.name_en}</Title>
        <T>بلّغ عن بيانات إتاحة غير صحيحة</T>
      </Card>
      <Card>
        <Title>ما نوع المشكلة؟</Title>
        <View style={S.wrap} pointerEvents={editable ? "auto" : "none"}>
          {reportIssues.map(({ value, label }) => (
            <Chip
              key={value}
              label={label}
              active={kind === value}
              onPress={() => { if (editable) setKind(value); }}
            />
          ))}
        </View>
        <FieldError text={attempted && !isReportIssue(kind) ? "اختر نوع المشكلة." : undefined} />
      </Card>
      <Card>
        <Field
          error={attempted && !text.trim() ? "أدخل وصف المشكلة." : undefined}
          label="وصف المشكلة"
          multiline
          editable={editable}
          value={text}
          onChangeText={(value) => { if (editable) setText(value); }}
          placeholder="اشرح المعلومة غير الدقيقة أو الناقصة."
        />
      </Card>
      <Card style={{ backgroundColor: C.soft }}>
        <View style={S.row}>
          <Icon name="shield" />
          <T bold>بلاغك يساعد الآخرين</T>
        </View>
        <T size={14}>يراجع فريق عون البلاغ لتحديث معلومات المكان.</T>
      </Card>
      {authLoading && <Message text="جارٍ التحقق من الحساب…" />}
      {state === "submitting" && <ActivityIndicator accessibilityLabel={tr("جارٍ إرسال البلاغ")} />}
      {state === "rejected" && <Message text="لم يُرسل البلاغ. يمكنك المحاولة مرة أخرى." />}
      {(state === "uncertain" || state === "checking") && (
        <>
          <Message text="قد يكون البلاغ قد حُفظ بالفعل. تحقّقي من حالته قبل إرساله مرة أخرى." />
          {state === "checking" ? (
            <ActivityIndicator accessibilityLabel={tr("جارٍ التحقق من البلاغ")} />
          ) : (
            <Btn
              label="التحقق من البلاغ"
              disabled={!canSubmit}
              onPress={() => void submission.reconcile(session.user.id, ({ previousId, draft }) =>
                findSubmittedReport(session, place.id, previousId, draft))}
            />
          )}
          <Btn label="العودة إلى المكان" kind="soft" onPress={() => replace(details)} />
        </>
      )}
      <Btn label="إرسال البلاغ" disabled={!editable || !canSubmit} onPress={send} />
    </>
  );
}
