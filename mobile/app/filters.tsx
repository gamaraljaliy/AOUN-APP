import { useState } from "react";
import { View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Btn, Chip, Shell, Title } from "../ui/components";
import { facilityNames, useDemo } from "../ui/demo";
import { initialFacilities, categories } from "../ui/placeFilters";

export default function Filters() {
  const params = useLocalSearchParams<{
    from?: string;
    ids?: string;
    category?: string;
    q?: string;
  }>();
  const [ids, setIds] = useState(() => initialFacilities(params.ids));
  const [category, setCategory] = useState(params.category || "الكل");
  const { lang } = useDemo();
  const wrap = {
    flexDirection: lang === "ar" ? "row-reverse" : "row",
    flexWrap: "wrap",
    gap: 8,
  } as const;
  return (
    <Shell title="البحث والفلترة">
      <Title>الفئة</Title>
      <View style={wrap}>
        {categories.map((item) => (
          <Chip
            key={item}
            label={item}
            active={category === item}
            onPress={() => setCategory(item)}
          />
        ))}
      </View>
      <Title>تصفية حسب مرافق الإتاحة</Title>
      <View style={wrap}>
        {facilityNames.map((name, i) => (
          <Chip
            key={name}
            label={name}
            active={ids.includes(i + 1)}
            onPress={() =>
              setIds((current) =>
                current.includes(i + 1)
                  ? current.filter((id) => id !== i + 1)
                  : [...current, i + 1],
              )
            }
          />
        ))}
      </View>
      <Btn
        label="حفظ"
        onPress={() =>
          router.dismissTo({
            pathname: params.from === "/search" ? "/search" : "/home",
            params: {
              ids: ids.join(","),
              category,
              q: params.q ?? "",
              facility: "",
            },
          })
        }
      />
    </Shell>
  );
}
