'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { Briefcase, Wallet } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useAppStore } from '@/store/useAppStore'

export function SplashScreen({ onComplete, variant = 'initial' }: { onComplete?: () => void, variant?: 'initial' | 'switch' }) {
    const { mode } = useAppStore()
    const [step, setStep] = useState<'logo' | 'icon'>('logo')

    useEffect(() => {
        if (variant === 'initial') {
            // Just show logo for a bit then complete
            const timer = setTimeout(() => {
                onComplete?.()
            }, 1500)
            return () => clearTimeout(timer)
        } else {
            // Variant is switch, start with icon directly
            setStep('icon')
            const timer = setTimeout(() => {
                onComplete?.()
            }, 1500)
            return () => clearTimeout(timer)
        }
    }, [onComplete, variant])

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background">
            <AnimatePresence mode="wait">
                {variant === 'initial' ? (
                    <motion.div
                        key="logo"
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 1.2, opacity: 0 }}
                        transition={{ duration: 0.5 }}
                        className="flex flex-col items-center gap-4"
                    >
                        <div className="h-20 w-20 rounded-2xl bg-primary flex items-center justify-center shadow-xl">
                            <span className="text-primary-foreground font-bold text-4xl">LF</span>
                        </div>
                    </motion.div>
                ) : (
                    <motion.div
                        key="icon"
                        initial={{ scale: 0.8, opacity: 0, rotate: -180 }}
                        animate={{ scale: 1, opacity: 1, rotate: 0 }}
                        exit={{ scale: 0.8, opacity: 0 }}
                        transition={{ type: "spring", stiffness: 200, damping: 20 }}
                        className="flex flex-col items-center gap-4"
                    >
                        {mode === 'business' ? (
                            <div className="flex flex-col items-center gap-2">
                                <div className="h-20 w-20 rounded-full bg-primary/20 flex items-center justify-center text-primary">
                                    <Briefcase className="h-10 w-10" />
                                </div>
                                <span className="text-lg font-medium text-muted-foreground">Business Mode</span>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center gap-2">
                                <div className="h-20 w-20 rounded-full bg-primary/20 flex items-center justify-center text-primary">
                                    <Wallet className="h-10 w-10" />
                                </div>
                                <span className="text-lg font-medium text-muted-foreground">Personal Mode</span>
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}
