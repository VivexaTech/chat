import { RepairChat } from 'repair-series-connect';
import { useVisualViewport } from './hooks/useVisualViewport';

export function App() {
  const { height, offsetTop, isKeyboardOpen } = useVisualViewport();
  const usePinnedViewport = height !== null && (isKeyboardOpen || offsetTop > 0);

  return (
    <main
      style={
        usePinnedViewport
          ? { height: `${height}px`, top: `${offsetTop}px` }
          : undefined
      }
      className="fixed inset-x-0 top-0 h-dvh md:static md:h-dvh w-full bg-[#F6F4F1] md:p-4 lg:p-6 overflow-hidden"
    >
      <div className="h-full w-full max-w-[1440px] mx-auto bg-white md:rounded-2xl md:border md:border-[#2B1B12]/10 md:shadow-sm overflow-hidden">
        <RepairChat />
      </div>
    </main>
  );
}

export default App;
