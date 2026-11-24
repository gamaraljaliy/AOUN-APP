import { View } from "react-native";
import { usePlaceTarget } from "../../../ui/placeTarget";
import { useDemo } from "../../../ui/demo";
import { Btn, C, Card, Icon, T, back, replace } from "../../../ui/components";
import { ReviewForm } from "../../../ui/ReviewForm";
export default function DeleteRating() {
  const { id, live, details } = usePlaceTarget(),
    d = useDemo();
  return (
    <View style={{ flex: 1 }}>
      <View
        importantForAccessibility="no-hide-descendants"
        accessibilityElementsHidden
        style={{ flex: 1 }}
        pointerEvents="none"
      >
        <ReviewForm edit />
      </View>
      <View
        accessibilityViewIsModal
        style={{
          position: "absolute",
          inset: 0,
          justifyContent: "center",
          padding: 25,
          backgroundColor: "rgba(13,13,70,.42)",
        }}
      >
        <Card style={{ alignItems: "stretch" }}>
          <View style={{ alignSelf: "center" }}>
            <Icon name="trash" size={32} />
          </View>
          <T center bold size={26}>
            حذف التقييم؟
          </T>
          <T center>
            هل أنت متأكد من حذف تقييمك وملاحظاتك؟ لن يمكن التراجع عن هذا
            الإجراء.
          </T>
          <Btn
            kind="danger"
            label="حذف التقييم"
            onPress={() => {
              if (d.user)
                d.setReviews((all) =>
                  all.filter(
                    (r) =>
                      !!r.live !== live ||
                      r.placeId !== Number(id) ||
                      r.author !== d.email,
                  ),
                );
              replace(details);
            }}
          />
          <Btn kind="soft" label="إلغاء" onPress={() => back(details)} />
        </Card>
      </View>
    </View>
  );
}
