import { RepairChat } from 'repair-series-connect';

export function App() {
  return (
    <main className="h-dvh w-full bg-[#F4F5F7] md:p-4 lg:p-6">
      <div className="h-full w-full max-w-[1440px] mx-auto bg-white md:rounded-2xl md:border md:border-slate-900/10 md:shadow-sm overflow-hidden">
        <RepairChat />
      </div>
    </main>
  );
}

export default App;
