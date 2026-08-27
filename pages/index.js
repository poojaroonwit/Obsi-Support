export async function getServerSideProps() { return { redirect: { destination: '/inbox', permanent: false } }; }
export default function Home() { return null; }
