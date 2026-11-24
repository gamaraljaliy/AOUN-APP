import { useState } from "react";
import { useDemo } from "../../ui/demo";
import { Btn, Card, Link, Shell, T } from "../../ui/components";
export default function Reviews() {
  const d = useDemo(),
    [id, setId] = useState<number | null>(null);
  return (
    <Shell admin nav title="إدارة المراجعات">
      {d.reviews.map((r) => (
        <Card key={r.id}>
          <T bold>{r.name}</T>
          <T>{"★".repeat(r.score)}</T>
          <T>{r.placeName ?? d.places.find((p) => p.id === r.placeId)?.name}</T>
          <T>{r.text}</T>
          {id === r.id ? (
            <>
              <Btn
                label="تأكيد حذف المراجعة"
                kind="danger"
                onPress={() => {
                  d.setReviews((v) => v.filter((x) => x.id !== id));
                  setId(null);
                }}
              />
              <Link label="إلغاء" onPress={() => setId(null)} />
            </>
          ) : (
            <Btn
              kind="soft"
              label="حذف المراجعة المخالفة"
              onPress={() => setId(r.id)}
            />
          )}
        </Card>
      ))}
      {!d.reviews.length && <T>لا توجد مراجعات بعد.</T>}
    </Shell>
  );
}
