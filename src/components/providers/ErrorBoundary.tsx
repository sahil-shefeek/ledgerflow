'use client'

import React, { Component, ErrorInfo, ReactNode } from 'react'
import GlobalErrorFallback from './GlobalErrorFallback'

interface Props {
    children?: ReactNode
    fallback?: React.ComponentType<{ error: Error; reset: () => void }>
}

interface State {
    hasError: boolean
    error: Error | null
}

class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null,
    }

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error }
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('Uncaught error:', error, errorInfo)
    }

    public reset = () => {
        this.setState({ hasError: false, error: null })
    }

    public render() {
        if (this.state.hasError && this.state.error) {
            const FallbackComponent = this.props.fallback || GlobalErrorFallback

            return (
                <FallbackComponent
                    error={this.state.error}
                    reset={this.reset}
                />
            )
        }

        return this.props.children
    }
}

export default ErrorBoundary
