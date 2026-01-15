'use client'

import React, { useState, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Loader2, Camera } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import Cropper from 'react-easy-crop'
import { type Area } from 'react-easy-crop'

interface AvatarUploadProps {
    value?: string | null
    onChange?: (url: string) => void
    disabled?: boolean
    name?: string
}

export function AvatarUpload({ value, onChange, disabled, name }: AvatarUploadProps) {
    const [uploading, setUploading] = useState(false)
    const [imageSrc, setImageSrc] = useState<string | null>(null)
    const [crop, setCrop] = useState({ x: 0, y: 0 })
    const [zoom, setZoom] = useState(1)
    const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null)
    const [isDialogOpen, setIsDialogOpen] = useState(false)

    const fileInputRef = useRef<HTMLInputElement>(null)
    const supabase = createClient()

    const onCropComplete = useCallback((croppedArea: Area, croppedAreaPixels: Area) => {
        setCroppedAreaPixels(croppedAreaPixels)
    }, [])

    const readFile = (file: File) => {
        return new Promise<string>((resolve) => {
            const reader = new FileReader()
            reader.addEventListener('load', () => resolve(reader.result as string))
            reader.readAsDataURL(file)
        })
    }

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const file = e.target.files[0]
            if (!file.type.startsWith('image/')) {
                toast.error('Please upload an image file')
                return
            }
            if (file.size > 5 * 1024 * 1024) { // 5MB
                toast.error('Image size must be less than 5MB')
                return
            }

            const imageDataUrl = await readFile(file)
            setImageSrc(imageDataUrl)
            setIsDialogOpen(true)

            // Reset input so same file can be selected again
            if (fileInputRef.current) {
                fileInputRef.current.value = ''
            }
        }
    }

    const createCroppedImage = async () => {
        try {
            if (!imageSrc || !croppedAreaPixels) return null

            setUploading(true)
            const croppedImageBlob = await getCroppedImg(imageSrc, croppedAreaPixels)
            if (!croppedImageBlob) throw new Error('Could not crop image')

            const { data: { user } } = await supabase.auth.getUser()
            if (!user) throw new Error('Not authenticated')

            const fileExt = 'jpeg' // We always output jpeg from canvas
            const filePath = `${user.id}/${Math.random()}.${fileExt}`

            const { error: uploadError } = await supabase.storage
                .from('avatars')
                .upload(filePath, croppedImageBlob, {
                    upsert: true,
                    contentType: 'image/jpeg'
                })

            if (uploadError) throw uploadError

            const { data: { publicUrl } } = supabase.storage
                .from('avatars')
                .getPublicUrl(filePath)

            onChange?.(publicUrl)
            toast.success('Avatar updated successfully')
            setIsDialogOpen(false)
        } catch (error: any) {
            console.error('Error uploading avatar:', error)
            toast.error(error.message || 'Error uploading avatar')
        } finally {
            setUploading(false)
            setImageSrc(null)
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

            <Dialog open={isDialogOpen} onOpenChange={(open) => !uploading && setIsDialogOpen(open)}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Crop Profile Picture</DialogTitle>
                    </DialogHeader>
                    <div className="relative w-full h-80 bg-black/5 rounded-md overflow-hidden mt-4">
                        {imageSrc && (
                            <Cropper
                                image={imageSrc}
                                crop={crop}
                                zoom={zoom}
                                aspect={1}
                                onCropChange={setCrop}
                                onCropComplete={onCropComplete}
                                onZoomChange={setZoom}
                                showGrid={false}
                                cropShape="round"
                            />
                        )}
                    </div>
                    <DialogFooter className="mt-4 sm:justify-between gap-2">
                        <div className="hidden sm:block text-xs text-muted-foreground self-center">
                            Scroll to zoom • Drag to move
                        </div>
                        <div className="flex gap-2 w-full sm:w-auto">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setIsDialogOpen(false)}
                                disabled={uploading}
                                className="flex-1 sm:flex-none"
                            >
                                Cancel
                            </Button>
                            <Button
                                type="button"
                                onClick={createCroppedImage}
                                disabled={uploading}
                                className="flex-1 sm:flex-none"
                            >
                                {uploading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Save
                            </Button>
                        </div>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}

// Utility functions for canvas cropping
const createImage = (url: string): Promise<HTMLImageElement> =>
    new Promise((resolve, reject) => {
        const image = new Image()
        image.addEventListener('load', () => resolve(image))
        image.addEventListener('error', (error) => reject(error))
        image.setAttribute('crossOrigin', 'anonymous')
        image.src = url
    })

async function getCroppedImg(
    imageSrc: string,
    pixelCrop: Area
): Promise<Blob | null> {
    const image = await createImage(imageSrc)
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')

    if (!ctx) {
        return null
    }

    canvas.width = pixelCrop.width
    canvas.height = pixelCrop.height

    ctx.drawImage(
        image,
        pixelCrop.x,
        pixelCrop.y,
        pixelCrop.width,
        pixelCrop.height,
        0,
        0,
        pixelCrop.width,
        pixelCrop.height
    )

    return new Promise((resolve) => {
        canvas.toBlob((blob) => {
            resolve(blob)
        }, 'image/jpeg', 0.95)
    })
}
