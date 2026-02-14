'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { usePathname, useRouter } from 'next/navigation';

type IconComponentType = React.ElementType<{ className?: string }>;

export interface InteractiveMenuItem {
    label: string;
    href?: string;
    icon: IconComponentType;
    showIn?: 'business' | 'personal';
}

export interface InteractiveMenuProps {
    items: InteractiveMenuItem[];
    className?: string;
}

const InteractiveBottomNav: React.FC<InteractiveMenuProps> = ({ items, className }) => {
    const pathname = usePathname();
    const router = useRouter();

    // Filter items that shouldn't be valid - though simpler is better here
    const finalItems = useMemo(() => {
        if (!items || !Array.isArray(items) || items.length < 2) {
            console.warn("InteractiveBottomNav: 'items' prop should have at least 2 items.");
            return items || [];
        }
        return items;
    }, [items]);

    // Determine active index based on current pathname
    const [activeIndex, setActiveIndex] = useState(0);

    useEffect(() => {
        const index = finalItems.findIndex(item => item.href && pathname === item.href);
        if (index !== -1) {
            setActiveIndex(index);
        }
    }, [pathname, finalItems]);

    const textRefs = useRef<(HTMLElement | null)[]>([]);
    const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

    useEffect(() => {
        const setLineWidth = () => {
            const activeItemElement = itemRefs.current[activeIndex];
            const activeTextElement = textRefs.current[activeIndex];

            if (activeItemElement && activeTextElement) {
                const textWidth = activeTextElement.offsetWidth;
                activeItemElement.style.setProperty('--lineWidth', `${textWidth}px`);
            }
        };

        setLineWidth();

        window.addEventListener('resize', setLineWidth);
        return () => {
            window.removeEventListener('resize', setLineWidth);
        };
    }, [activeIndex, finalItems]);

    const handleItemClick = (index: number, item: InteractiveMenuItem) => {
        setActiveIndex(index);
        if (item.href) {
            router.push(item.href);
        }
    };

    const navStyle = {
        '--component-active-color': 'var(--component-active-color-default)',
    } as React.CSSProperties;

    return (
        <nav
            className={`menu ${className || ''}`}
            role="navigation"
            style={navStyle}
        >
            {finalItems.map((item, index) => {
                const isActive = index === activeIndex;
                const IconComponent = item.icon;

                return (
                    <button
                        key={item.label}
                        className={`menu__item ${isActive ? 'active' : ''}`}
                        onClick={() => handleItemClick(index, item)}
                        ref={(el) => { itemRefs.current[index] = el; }}
                        style={{ '--lineWidth': '0px' } as React.CSSProperties}
                    >
                        <div className="menu__icon">
                            <IconComponent className="icon" />
                        </div>
                        <strong
                            className={`menu__text ${isActive ? 'active' : ''}`}
                            ref={(el) => { textRefs.current[index] = el; }}
                        >
                            {item.label}
                        </strong>
                    </button>
                );
            })}
        </nav>
    );
};

export { InteractiveBottomNav };
