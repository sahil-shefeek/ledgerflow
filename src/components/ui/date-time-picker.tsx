"use client"

import * as React from "react"
import { format } from "date-fns"
import { Calendar as CalendarIcon, Clock } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export function DateTimePicker({
    date,
    setDate,
}: {
    date: Date | undefined
    setDate: (date: Date | undefined) => void
}) {
    const [selectedDateTime, setSelectedDateTime] = React.useState<Date | undefined>(
        date
    )

    React.useEffect(() => {
        if (date) {
            setSelectedDateTime(date)
        }
    }, [date])

    const handleDateSelect = (selectedDate: Date | undefined) => {
        if (selectedDate) {
            const newDateTime = new Date(selectedDate)
            if (selectedDateTime) {
                newDateTime.setHours(selectedDateTime.getHours())
                newDateTime.setMinutes(selectedDateTime.getMinutes())
            } else {
                const now = new Date()
                newDateTime.setHours(now.getHours())
                newDateTime.setMinutes(now.getMinutes())
            }
            setSelectedDateTime(newDateTime)
            setDate(newDateTime)
        } else {
            setSelectedDateTime(undefined)
            setDate(undefined)
        }
    }

    const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const [hours, minutes] = e.target.value.split(':')
        if (hours && minutes && selectedDateTime) {
            const newDateTime = new Date(selectedDateTime)
            newDateTime.setHours(parseInt(hours))
            newDateTime.setMinutes(parseInt(minutes))
            setSelectedDateTime(newDateTime)
            setDate(newDateTime)
        }
    }

    return (
        <Popover>
            <PopoverTrigger asChild>
                <Button
                    variant={"outline"}
                    className={cn(
                        "w-[280px] justify-start text-left font-normal",
                        !date && "text-muted-foreground"
                    )}
                >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {date ? format(date, "PPP HH:mm") : <span>Pick a date</span>}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
                <Calendar
                    mode="single"
                    selected={selectedDateTime}
                    onSelect={handleDateSelect}
                    initialFocus
                />
                <div className="p-3 border-t border-border">
                    <Label className="text-xs">Time</Label>
                    <div className="flex items-center gap-2 mt-1">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <Input
                            type="time"
                            className="h-8"
                            value={selectedDateTime ? format(selectedDateTime, "HH:mm") : ""}
                            onChange={handleTimeChange}
                        />
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    )
}
