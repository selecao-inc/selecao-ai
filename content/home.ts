// トップページ（案G）の文言とダミーデータ。正式な文言・事例は今後決めるため、すべて仮のもの（Issue #37）

export type Category = 0 | 1 | 2;

export type Consultation = {
  /** 対応するカテゴリ（CATEGORIES の番号）。表示中はこのチップを黒くする */
  cat: Category;
  /** 「進めかた：〈作るもの〉」に出す作るもの */
  job: string;
  /** 相談 */
  q: string;
  /** 返信 */
  a: string;
};

export const CATEGORIES = ["AI 開発チームの立ち上げ", "業務の AI 化", "Web サイトの制作・運用"] as const;

// ソフトウェアファクトリーの工程。作る AI と確かめる AI を分け、最後は人が確認する
export const STEPS = [
  { label: "計画", who: "AI が作業に分ける" },
  { label: "実装", who: "AI が並行して作る" },
  { label: "検証", who: "別の AI が確かめる" },
  { label: "公開", who: "人が確認して出す" },
] as const;

export const CONSULTATIONS: readonly Consultation[] = [
  {
    cat: 1,
    job: "請求書チェックの仕組み",
    q: "毎月の請求書のチェック、AI に任せられますか？",
    a: "任せられる部分は多いです。まず今の手順を一緒に洗い出し、人が判断するところと AI に渡すところを分けます。小さく試して、現場で回ることを確かめてから広げます。",
  },
  {
    cat: 0,
    job: "最初の1つの業務",
    q: "社内に AI に詳しい人がいません。何から始めればいいですか？",
    a: "最初は、いちばん手間のかかっている仕事を1つ選ぶところからです。私たちがチームに入り、作りながら、やり方を社内の方に引き継いでいきます。",
  },
  {
    cat: 1,
    job: "返信の下書き",
    q: "問い合わせへの返信を、AI で下書きしたい",
    a: "過去の返信をもとに、下書きを作る仕組みを用意できます。送る前に人が確かめる流れにして、品質を保ったまま返信の手間を減らします。",
  },
  {
    cat: 0,
    job: "試作品",
    q: "新しいサービスの試作品を、早く形にしたい",
    a: "AI エージェントを組み込んだ開発チームで、考えるところから作るところまで進めます。まず動く試作品を作り、触りながら仕様を固めていきます。",
  },
  {
    cat: 2,
    job: "新しいサイト",
    q: "会社のサイトを作り直して、更新も楽にしたい",
    a: "構成と文章の整理から、制作、公開後の更新まで担当します。更新の作業も AI で軽くして、サイトを育て続けられる形にします。",
  },
];

export const DEMO = {
  label: "相談と返信の例が自動で流れる画面",
  placeholder: "相談したいことを入力",
  flowPrefix: "進めかた：",
  flowRunning: "進行中",
  flowDone: "公開しました",
} as const;

export const SITE = {
  name: "SELECAO",
  nameKana: "セレソン",
  company: "株式会社セレソン",
  copyright: "© SELECAO Inc.",
  contactLabel: "相談する",
} as const;

export const NAV = [
  { label: "サービス", href: "#services" },
  { label: "事例", href: "#cases" },
  { label: "会社概要", href: "#about" },
] as const;

export const HERO = {
  heading: "AI で、何を変えますか？",
  tryLink: "実際に相談してみる",
} as const;

export const FEATURED = {
  heading: "注目の事例",
  main: { title: "[ダミー] 製造業 A 社：受発注の確認作業を AI に任せた3か月", meta: "事例　2026年00月00日", image: "[事例の画像]" },
  side: [
    { title: "[ダミー] AI に詳しい人がいない会社が、最初にやること", meta: "考え方　2026年00月00日" },
    { title: "[ダミー] 小売 B 社：問い合わせの返信を AI で下書き", meta: "事例　2026年00月00日" },
  ],
} as const;

export const SERVICES = {
  heading: "サービス",
  more: "すべてを表示",
  items: [
    { title: "AI 開発チームの立ち上げ", body: "AI エージェントを組み込んだ開発の体制を、ゼロからつくります。" },
    { title: "業務の AI 化", body: "日々の業務のうち、AI に任せられるところから置き換えます。" },
    { title: "Web サイトの制作・運用", body: "企画から制作、公開後の更新まで担当します。" },
  ],
} as const;

export const STRENGTHS = {
  heading: "考えるところから、作るところまで一社で",
  items: [
    { title: "助言", body: "方針づくりや道具選びを、外から支えます。" },
    { title: "参画", body: "チームの一員として、社内に入って進めます。" },
    { title: "受託", body: "要件を受け取り、作って納めます。" },
  ],
} as const;

export const CASES = {
  heading: "事例",
  more: "すべてを表示",
  dummyNote: "※ 事例・業種・日付はすべてダミーです",
  items: [
    { title: "[業種C] の会社で、日報の集計を自動にした", meta: "業務の AI 化　2026年00月00日" },
    { title: "[業種D] の会社に、AI 開発チームを立ち上げた", meta: "AI 開発チーム　2026年00月00日" },
    { title: "[業種E] の会社のサイトを作り直し、更新を軽くした", meta: "Web サイト　2026年00月00日" },
    { title: "[業種F] の会社で、見積もりの下書きを AI に任せた", meta: "業務の AI 化　2026年00月00日" },
  ],
} as const;

export const CONTACT = {
  heading: "まずは、いまの状況を聞かせてください",
  body: "社内に AI に詳しい人がいなくても大丈夫です。",
} as const;

export const FOOTER = {
  menus: [
    {
      label: "フッターメニュー",
      links: [
        { label: "トップ", href: "/" },
        { label: "サービス", href: "#services" },
      ],
    },
    {
      label: "会社",
      links: [
        { label: "会社概要", href: "#about" },
        { label: "お問い合わせ", href: "#contact" },
      ],
    },
  ],
} as const;
