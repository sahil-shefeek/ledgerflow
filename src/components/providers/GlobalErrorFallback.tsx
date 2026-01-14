'use client'

import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface GlobalErrorFallbackProps {
    error: Error
    reset: () => void
}

export default function GlobalErrorFallback({
    error,
    reset,
}: GlobalErrorFallbackProps) {
    return (
        <div className="flex min-h-screen items-center justify-center p-4 bg-background">
            <Card className="max-w-md w-full border-destructive/50">
                <CardHeader className="text-center pb-2">
                    <div className="flex justify-center mb-4">
                        <div className="p-3 bg-destructive/10 rounded-full">
                            <AlertTriangle className="h-8 w-8 text-destructive" />
                        </div>
                    </div>
                    <CardTitle className="text-xl">Something went wrong!</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 text-center">
                    <p className="text-muted-foreground text-sm">
                        {error.message || 'An unexpected error occurred. Please try again.'}
                    </p>
                    <Button onClick={reset} variant="default" className="w-full">
                        Try Again
                    </Button>
                </CardContent>
            </Card>
        </div>
    )
}
