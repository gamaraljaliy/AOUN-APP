import { useState } from "react";
import { useDemo } from "../ui/demo";
import { Card, Chip, Field, Round, S, Shell, T, go } from "../ui/components";
import { PlaceCard } from "../ui/places";
import { View } from "react-native";
export default function Home() {
  const d = useDemo();
  const [q, setQ] = useState("");
  const list = d.places.filter((p) => (p.name + p.category).includes(q.trim()));
  return (
    <Shell brand nav>
      <View style={S.row}>
        <View style={{ flex: 1 }}>
          <Field
            label="البحث عن مكان"
            placeholder="ابحث عن مكان..."
            value={q}
            onChangeText={setQ}
          />
        </View>
        <Round
          icon="sort"
          label="البحث والفلترة"
          onPress={() => go("/search")}
        />
      </View>
      <View style={S.wrap}>
        {["منحدرات", "مصاعد", "دورات مياه مهيأة"].map((x, i) => (
          <Chip key={x} label={x} onPress={() => go("/search?facility=" + i)} />
        ))}
      </View>
      {list.map((p) => (
        <PlaceCard p={p} key={p.id} />
      ))}
      {!list.length && (
        <Card>
          <T>لا توجد نتائج مطابقة.</T>
        </Card>
      )}
    </Shell>
  );
}
