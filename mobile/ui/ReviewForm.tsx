import { useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { router, useLocalSearchParams, type Href } from "expo-router";
import type { Session } from "@supabase/supabase-js";
import { ActivityIndicator, Pressable, View } from "react-native";
import {
  deleteRating,
  getOwnRating,
  saveRating,
  validReviewScore,
  type OwnRating,
} from "../services/reviews";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import {
  attachReviewPhotos, isManagedPhoto, MAX_PHOTOS, prepareReviewPhoto,
  readSelectedPhoto, retireAndRemoveReviewPhoto, reviewPhotoUri, uploadReviewPhoto, verifyUploadedReviewPhoto,
  type SelectedPhoto,
} from "../services/reviewPhotos";
import { createReviewPhotoWorkflow, type PhotoSaveResult } from "./reviewPhotoWorkflow";
import { usePlaceTarget } from "./placeTarget";
import { useOwnRating } from "./useOwnRating";
import { createReviewDraft } from "./reviewDraft";
import {
  Btn, C, Card, Field, FieldError, Icon, Message, Round, S, Shell, T, Title,
  back, go,
} from "./components";

export function ReviewForm({
  edit = false,
  confirmDelete = false,
}: {
  edit?: boolean;
  confirmDelete?: boolean;
}) {
  const {from} = useLocalSearchParams<{from?: string}>();
  const target = usePlaceTarget();
  const id = Number(target.id);
  const placeId = target.live && Number.isInteger(id) && id > 0 && id <= 2147483647
    ? id
    : undefined;
  const review = useOwnRating(placeId);
  const title = edit ? "تعديل التقييم" : "إضافة تجربة وصول";
  if (placeId === undefined) {
    return <Shell title={title}><Message text="التقييم متاح للأماكن المنشورة فقط." /></Shell>;
  }
  if (review.loading) {
    return <Shell title={title}><ActivityIndicator /></Shell>;
  }
  if (!review.signedIn) {
    return (
      <Shell title={title}>
        <Btn label="تسجيل الدخول" onPress={() => go("/login")} />
      </Shell>
    );
  }
  if (!review.session) {
    return (
      <Shell title={title}>
        <Message text={review.authError || "التقييم متاح للأعضاء النشطين."} />
      </Shell>
    );
  }
  if (review.result?.status !== "ready") {
    return (
      <Shell title={title}>
        <Message text="تعذّر تحميل تقييمك." />
        <Btn label="إعادة المحاولة" onPress={review.retry} />
      </Shell>
    );
  }

  const { rating, signal } = review.result;
  return (
    <RatingEditor
      key={review.session.user.id + ":" + placeId + ":" + (rating?.id ?? "new")}
      session={review.session}
      placeId={placeId}
      name={target.place?.name ?? ""}
      details={from === "activity" ? "/my-ratings" : target.details}
      deletePath={target.form("delete-rating") + (from === "activity" ? "&from=activity" : "")}
      rating={rating}
      signal={signal}
      canSubmit={review.canSubmit}
      authError={review.authError}
      confirmDelete={confirmDelete}
    />
  );
}

function RatingEditor({
  session, placeId, name, details, deletePath, rating, signal, canSubmit, authError, confirmDelete,
}: {
  session: Session;
  placeId: number;
  name: string;
  details: string;
  deletePath: string;
  rating: OwnRating | null;
  signal: AbortSignal;
  canSubmit: boolean;
  authError: string;
  confirmDelete: boolean;
}) {
  const [editor] = useState(() => createReviewDraft(rating, confirmDelete));
  const draft = useSyncExternalStore(editor.subscribe, editor.getSnapshot, editor.getSnapshot);
  const [attempted, setAttempted] = useState(false);
  const [selected, setSelected] = useState<SelectedPhoto[]>([]);
  const [removed, setRemoved] = useState<string[]>([]);
  const [pickerError, setPickerError] = useState(false);
  const [picking, setPicking] = useState(false);
  const pickerLock = useRef(false);
  const [photoResult, setPhotoResult] = useState<PhotoSaveResult>();
  const [uploading, setUploading] = useState(false);
  const saving = useRef(false);
  const job = useRef<{
    ratingId?: number;
    workflow: ReturnType<typeof createReviewPhotoWorkflow>;
  } | null>(null);
  const mounted = useRef(false);
  useLayoutEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  const latest = useRef({ session, canSubmit });
  latest.current = { session, canSubmit };
  const { score, text } = draft;
  const existing = draft.rating;
  const pending = draft.status === "pending" || uploading;
  const uncertain = draft.status === "uncertain";
  const editable = draft.status === "editing" && !uploading;
  const fixingPhotos = photoResult === "invalid" && !uploading;
  const existingPaths = existing?.photo_paths ?? [];
  const visiblePaths = existingPaths.filter((path) => !removed.includes(path));
  const remainingManaged = visiblePaths.filter((path) => isManagedPhoto(path, existing?.id)).length;
  const slots = MAX_PHOTOS - selected.length - remainingManaged;

  async function pickPhoto() {
    if ((!editable && !fixingPhotos) || !canSubmit || pickerLock.current || saving.current || slots <= 0) return;
    pickerLock.current = true;
    setPicking(true);
    setPickerError(false);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"] });
      if (result.canceled) return;
      const photo = await readSelectedPhoto(result.assets[0]);
      if (mounted.current && !signal.aborted && selected.length + remainingManaged < MAX_PHOTOS) {
        if (fixingPhotos) job.current?.workflow.addReplacement(photo);
        setSelected((photos) => [...photos, photo]);
      }
    } catch {
      if (mounted.current && !signal.aborted) setPickerError(true);
    } finally {
      pickerLock.current = false;
      if (mounted.current && !signal.aborted) setPicking(false);
    }
  }
  const deleteBlocked = confirmDelete && (!existing || draft.feedback === "changed");

  async function submit() {
    if (!latest.current.canSubmit || signal.aborted || saving.current || pickerLock.current) return;
    if (!job.current && !confirmDelete && slots < 0 && (selected.length || removed.length)) return;
    if (!job.current && !uncertain && !confirmDelete && !validReviewScore(score)) {
      setAttempted(true);
      return;
    }

    const ownerId = session.user.id;
    const isCurrent = () => mounted.current && !signal.aborted &&
      latest.current.session.user.id === ownerId;
    const account = () => latest.current.session;
    const read = () => getOwnRating(account(), placeId, signal);
    saving.current = true;
    let deletedPaths = existingPaths;
    let confirmedRatingId = existing?.id;
    try {
      if (!job.current) {
        const confirmed = await editor.submit({
          isCurrent,
          write: async ({ rating: stored, score: value, text: reviewText }) => {
            if (confirmDelete && stored) {
              deletedPaths = await deleteRating(account(), placeId, stored.id, signal) ?? deletedPaths;
            } else {
              confirmedRatingId = await saveRating(account(), placeId, stored?.id, value, reviewText, signal);
            }
          },
          read: async () => {
            const actual = await read();
            if (!confirmDelete && !existing) confirmedRatingId = actual?.id;
            return actual;
          },
        });
        if (!confirmed || !isCurrent()) return;
        const removals = confirmDelete
          ? deletedPaths.filter((path) => isManagedPhoto(path, existing?.id))
          : removed.filter((path) => existingPaths.includes(path));
        if (!removals.length && !selected.length) {
          router.dismissTo(details as Href);
          return;
        }
        job.current = {
          ratingId: confirmedRatingId,
          workflow: createReviewPhotoWorkflow(existingPaths, removals, selected, confirmDelete),
        };
      }

      setUploading(true);
      const operation = job.current;
      const ratingId = operation.ratingId;
      if (!ratingId) {
        setPhotoResult("retry");
        return;
      }
      const result = await operation.workflow.run({
        current: isCurrent,
        prepare: (photo) => prepareReviewPhoto(account(), ratingId, photo, signal),
        upload: (photo) => uploadReviewPhoto(account(), photo),
        verify: (photo) => verifyUploadedReviewPhoto(account(), ratingId, photo.key, signal),
        read: async () => {
          const rating = await read();
          return rating?.id === ratingId ? (rating.photo_paths ?? []) : null;
        },
        attach: (previous, next) => attachReviewPhotos(account(), ratingId, previous, next, signal),
        cleanup: (path) => retireAndRemoveReviewPhoto(account(), ratingId, path, signal),
      });
      if (!isCurrent()) return;
      if (result === "saved") router.dismissTo(details as Href);
      else if (result !== "stopped") setPhotoResult(result);
    } catch {
      if (isCurrent()) setPhotoResult("retry");
    } finally {
      saving.current = false;
      if (isCurrent()) setUploading(false);
    }
  }

  const feedback = (
    <>
      {pending && <ActivityIndicator accessibilityLabel="جارٍ تحديث التقييم" />}
      <Message text={authError || (!canSubmit && !pending ? "جارٍ التحقق من الحساب…" : "")} />
      {draft.feedback === "failed" && (
        <Message text="تعذّر تحديث التقييم. حاولي مجددًا." />
      )}
      {draft.feedback === "changed" && (
        <Message text={confirmDelete
          ? "تغيّر تقييمك. أغلقي نافذة الحذف وراجعي تقييمك قبل المحاولة مجددًا."
          : "تغيّر تقييمك على الخادم. احتفظنا بمسودتك لتراجعيها قبل الحفظ."} />
      )}
      {photoResult && !uploading && (
        <>
          <Message text={photoResult === "cleanup-pending"
            ? "حُفظ التغيير، لكن تعذّر تنظيف بعض الصور."
            : photoResult === "conflict"
              ? "تغيّرت الصور على الخادم. أعيدي فتح التقييم قبل تعديلها."
              : photoResult === "invalid"
                ? "حُفظ التقييم. أزيلي الصورة المرفوضة أو استبدليها للمتابعة."
                : "حُفظ التقييم، لكن لم يتأكد حفظ الصور."} />
          {photoResult !== "conflict" && (
            <Btn label="إعادة المحاولة" kind="soft"
              disabled={!canSubmit || picking || !!job.current?.workflow.hasRejected()}
              onPress={() => void submit()} />
          )}
          <Btn label={details === "/my-ratings" ? "تقييماتي" : "العودة إلى المكان"} kind="soft" onPress={() => router.dismissTo(details as Href)} />
        </>
      )}
      {uncertain && (
        <>
          <Message text="تعذّر التحقق من نتيجة الحفظ. تحققي منها قبل إعادة الإرسال." />
          <Btn label="إعادة المحاولة" kind="soft" disabled={!canSubmit} onPress={() => void submit()} />
        </>
      )}
    </>
  );
  const form = (
    <Shell
      title={existing || confirmDelete ? "تعديل التقييم" : "إضافة تجربة وصول"}
      action={existing && !confirmDelete && editable && canSubmit ? (
        <Round icon="trash" label="حذف التقييم" onPress={() => go(deletePath)} />
      ) : undefined}
    >
      <Card>
        <Title>التقييم العام لسهولة الوصول</Title>
        {!!name && <T size={14}>{name}</T>}
        <View style={[S.row, {
          justifyContent: "space-around", padding: 9,
          backgroundColor: C.soft, borderRadius: 20,
        }]}>
          {[1, 2, 3, 4, 5].map((n) => (
            <Pressable
              key={n}
              accessibilityRole="button"
              accessibilityLabel={n + " من 5"}
              accessibilityState={{ selected: score === n, disabled: !editable }}
              disabled={!editable}
              onPress={() => editor.setScore(n)}
            >
              <T size={30}>{n <= score ? "★" : "☆"}</T>
            </Pressable>
          ))}
        </View>
        <FieldError text={attempted && !validReviewScore(score)
          ? "اختر تقييمًا من ١ إلى ٥." : undefined} />
      </Card>
      <Card>
        <Field
          label="تفاصيل التجربة وملاحظات الزيارة"
          multiline
          maxLength={300}
          value={text}
          editable={editable}
          onChangeText={editor.setText}
          placeholder="كيف كانت تجربتك؟"
        />
        <T size={12}>{text.length + " / 300"}</T>
      </Card>
      {!confirmDelete && (
        <Card>
          <Title>توثيق بالصور للتسهيلات والمداخل</Title>
          <T size={14}>حتى ٣ صور بصيغة JPEG أو PNG، بحد أقصى ٥ ميبيبايت لكل صورة.</T>
          {!!existing && visiblePaths.map((path, index) => {
            const uri = reviewPhotoUri(existing.id, path);
            return (
              <View key={index + ":" + path} style={{ gap: 8 }}>
                {uri && <Image source={{ uri }} cachePolicy="none" style={{ height: 120, borderRadius: 12 }} />}
                <Btn
                  label="إزالة الصورة"
                  kind="soft"
                  disabled={!editable || picking}
                  onPress={() => {
                    if (!saving.current) setRemoved((paths) => [...paths, path]);
                  }}
                />
              </View>
            );
          })}
          {selected.map((photo, index) => (
            <View key={index + ":" + photo.uri} style={{ gap: 8 }}>
              <Image source={{ uri: photo.uri }} cachePolicy="none" style={{ height: 120, borderRadius: 12 }} />
              {fixingPhotos && job.current?.workflow.isRejected(photo) && (
                <Message text="هذه الصورة غير صالحة." />
              )}
              <Btn
                label="إزالة الصورة"
                kind="soft"
                disabled={picking || (!editable && !(fixingPhotos && job.current?.workflow.isRejected(photo)))}
                onPress={() => {
                  if (saving.current) return;
                  if (!editable && !job.current?.workflow.removeRejected(photo)) return;
                  setSelected((photos) => photos.filter((item) => item !== photo));
                }}
              />
            </View>
          ))}
          {removed.length > 0 && (
            <Btn
              label="التراجع عن إزالة الصور"
              kind="soft"
              disabled={!editable || picking ||
                existingPaths.filter((path) => isManagedPhoto(path, existing?.id)).length + selected.length > MAX_PHOTOS}
              onPress={() => { if (!saving.current) setRemoved([]); }}
            />
          )}
          <Btn
            label="رفع من المعرض"
            kind="soft"
            icon="gallery"
            disabled={(!editable && !fixingPhotos) || !canSubmit || picking || slots <= 0}
            onPress={() => void pickPhoto()}
          />
          {picking && <ActivityIndicator />}
          {pickerError && <Message text="اختاري صورة JPEG أو PNG بحجم لا يتجاوز ٥ ميبيبايت." />}
        </Card>
      )}
      {!confirmDelete && feedback}
      <Btn
        label={existing ? "حفظ التعديلات" : "نشر التقييم"}
        disabled={!editable || !canSubmit || picking}
        onPress={() => void submit()}
      />
    </Shell>
  );

  if (!confirmDelete) return form;

  return (
    <View style={{ flex: 1 }}>
      <View
        importantForAccessibility="no-hide-descendants"
        accessibilityElementsHidden
        style={{ flex: 1 }}
        pointerEvents="none"
      >
        {form}
      </View>
      <View
        accessibilityViewIsModal
        style={{
          position: "absolute", inset: 0, justifyContent: "center", padding: 25,
          backgroundColor: "rgba(13,13,70,.42)",
        }}
      >
        <Card style={{ alignItems: "stretch" }}>
          <View style={{ alignSelf: "center" }}><Icon name="trash" size={32} /></View>
          <T center bold size={26}>حذف التقييم؟</T>
          {existing ? (
            <T center>هل أنت متأكد من حذف تقييمك وملاحظاتك؟ لن يمكن التراجع عن هذا الإجراء.</T>
          ) : (
            <T center>لا يوجد تقييم لك لهذا المكان.</T>
          )}
          {feedback}
          {!!existing && (
            <Btn
              kind="danger"
              label="حذف التقييم"
              disabled={!editable || !canSubmit || deleteBlocked}
              onPress={() => void submit()}
            />
          )}
          <Btn
            kind="soft"
            label="إلغاء"
            disabled={pending}
            onPress={() => draft.feedback === "changed"
              ? router.dismissTo(details as Href)
              : back(details)}
          />
        </Card>
      </View>
    </View>
  );
}
