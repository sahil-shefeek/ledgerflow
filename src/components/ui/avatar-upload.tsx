'use client'

import React, { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Loader2, Camera, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface AvatarUploadProps {
    value?: string | null
    onChange?: (url: string) => void
    disabled?: boolean
    name?: string
}

export function AvatarUpload({ value, onChange, disabled, name }: AvatarUploadProps) {
    const [uploading, setUploading] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const supabase = createClient()

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        // Validation
        if (!file.type.startsWith('image/')) {
            toast.error('Please upload an image file')
            return
        }

        if (file.size > 5 * 1024 * 1024) { // 5MB
            toast.error('Image size must be less than 5MB')
            return
        }

        try {
            setUploading(true)
            const { data: { user } } = await supabase.auth.getUser()

            if (!user) throw new Error('Not authenticated')

            const fileExt = file.name.split('.').pop()
            const filePath = `${user.id}/${Math.random()}.${fileExt}`

            const { error: uploadError } = await supabase.storage
                .from('avatars')
                .upload(filePath, file, { upsert: true })

            if (uploadError) throw uploadError

            const { data: { publicUrl } } = supabase.storage
                .from('avatars')
                .getPublicUrl(filePath)

            onChange?.(publicUrl)
            toast.success('Avatar uploaded successfully')
        } catch (error: any) {
            console.error('Error uploading avatar:', error)
            toast.error(error.message || 'Error uploading avatar')
        } finally {
            setUploading(false)
            // Reset input so same file can be selected again
            if (fileInputRef.current) {
                fileInputRef.current.value = ''
            }
        }
    }

    return (
        <div className="flex flex-col items-center gap-4">
            <div className="relative group cursor-pointer" onClick={() => !disabled && !uploading && fileInputRef.current?.click()}>
                <Avatar className="w-24 h-24 border-2 border-muted">
                    <AvatarImage src={value || ''} alt={name || 'User avatar'} className="object-cover" />
                    <AvatarFallback>{name?.charAt(0) || 'U'}</AvatarFallback>
                </Avatar>

                <div className={cn(
                    "absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity",
                    uploading && "opacity-100 cursor-not-allowed"
                )}>
                    {uploading ? (
                        <Loader2 className="w-6 h-6 text-white animate-spin" />
                    ) : (
                        <Camera className="w-6 h-6 text-white" />
                    )}
                </div>
            </div>

            <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={disabled || uploading}
                onClick={() => fileInputRef.current?.click()}
            >
                {uploading ? 'Uploading...' : 'Change Avatar'}
            </Button>

            <Input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileSelect}
                disabled={disabled || uploading}
            />
        </div>
    )
}
