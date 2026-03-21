import { Ticker } from "@/components/layout/Ticker";
import { SummaryCards } from "@/components/dashboard/SummaryCards";
import { PerformanceChart, AllocationChart } from "@/components/dashboard/Charts";
import { HoldingsTable } from "@/components/holdings/HoldingsTable";
import { AddHoldingDialog } from "@/components/holdings/HoldingForms";
import { usePortfolio } from "@/hooks/use-portfolio";
import { motion } from "framer-motion";

export default function Dashboard() {
  const { holdings, totals, isLoading } = usePortfolio();

  return (
    <div className="min-h-screen bg-background text-foreground font-sans selection:bg-primary/30 relative">
      {/* Background Decor - Abstract Glow */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute top-[-20%] left-[-10%] w-[80%] md:w-[50%] h-[50%] rounded-full bg-primary/10 blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[60%] md:w-[40%] h-[40%] rounded-full bg-accent/5 blur-[100px]" />
        <img src={`${import.meta.env.BASE_URL}images/hero-bg.png`} alt="" className="absolute inset-0 w-full h-full object-cover opacity-10 mix-blend-overlay" />
      </div>

      {/* Fixed Header / Ticker */}
      <Ticker />

      {/* Main Content */}
      <main className="relative z-10 pt-14 md:pt-16 pb-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 overflow-x-hidden">
        
        {/* Header Section */}
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col sm:flex-row justify-between items-start sm:items-end mb-6 md:mb-8 mt-4 md:mt-6 space-y-4 sm:space-y-0"
        >
          <div>
            <h1 className="text-3xl md:text-4xl font-display font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white to-white/70">
              Wealth Overview
            </h1>
            <p className="text-muted-foreground mt-1 text-sm md:text-base">Track your investments and performance in real-time.</p>
          </div>
          <div className="w-full sm:w-auto">
            <AddHoldingDialog />
          </div>
        </motion.div>

        {/* Dashboard Sections */}
        <div className="space-y-6 md:space-y-8">
          <SummaryCards totals={totals} isLoading={isLoading} />
          
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="grid grid-cols-1 lg:grid-cols-3 gap-6"
          >
            <div className="lg:col-span-2">
              <PerformanceChart />
            </div>
            <div className="lg:col-span-1">
              <AllocationChart holdings={holdings} />
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <div className="mb-4">
              <h2 className="text-2xl font-display font-bold">Your Holdings</h2>
              <p className="text-sm text-muted-foreground">Manage and track individual assets.</p>
            </div>
            <HoldingsTable holdings={holdings} />
          </motion.div>
        </div>
        
      </main>
    </div>
  );
}
