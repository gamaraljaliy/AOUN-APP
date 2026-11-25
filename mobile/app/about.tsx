import { Card, Logo, Shell, T, Title, back } from "../ui/components";
import { guideSteps } from "../ui/guide";

export default function About() {
  return (
    <Shell title="حول عون" onBack={() => back("/profile")}>
      <Card style={{ alignItems: "center" }}>
        <Logo size={80} />
        <T center>
          يساعدك عون على معرفة مدى تهيئة الأماكن العامة في الرياض للأشخاص ذوي
          الإعاقة وكبار السن ومرافقيهم، حتى تختار المكان المناسب قبل زيارتك.
        </T>
      </Card>
      <Title>كيف تستخدم عون؟</Title>
      {guideSteps.map((step) => (
        <Card key={step.icon}>
          <T bold>{step.title}</T>
          <T>{step.body}</T>
        </Card>
      ))}
    </Shell>
  );
}
