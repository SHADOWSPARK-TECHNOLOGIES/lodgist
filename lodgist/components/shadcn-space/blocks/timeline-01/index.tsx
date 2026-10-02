"use client";

import Timeline from "@/components/shadcn-space/blocks/timeline-01/timeline";
import { Badge } from "@/components/ui/badge";

const timelineData = [
    {
        title: "Agency Founded",
        description:
            "Started with a mission to create meaningful digital experiences through strategy and thoughtful design.",
        date: "2022",
        image:
            "https://images.shadcnspace.com/assets/team/team-5-img-1.webp",
    },
    {
        title: "First Major Clients",
        description:
            "Partnered with ambitious businesses looking to transform their online presence and customer engagement.",
        date: "2024",
        image:
            "https://images.shadcnspace.com/assets/services/services-img-1.webp",
    },
    {
        title: "Global Reach",
        description:
            "Working with clients worldwide while continuing to deliver impactful and measurable digital experiences.",
        date: "2026",
        image:
            "https://images.shadcnspace.com/assets/services/services-08-bg-01.webp",
    },
];

const TimelineBlock01 = () => {
    return (
        <section className="overflow-hidden">
            <div className="max-w-7xl mx-auto px-4 md:px-8 lg:px-16">
                <div className="border-x border-b border-border px-6 py-10 md:px-10 md:py-16 lg:px-16 lg:py-20">
                    <div className="max-w-2xl space-y-4">
                        <Badge
                            variant="outline"
                            className="rounded-full px-3 py-1 font-normal"
                        >
                            Timeline
                        </Badge>
                        <div className="space-y-3">
                            <h2 className="text-3xl md:text-4xl lg:text-5xl font-medium tracking-tight text-foreground">
                                A Story Of Growth
                            </h2>
                            <p className="md:text-lg text-base text-muted-foreground leading-relaxed">
                                Our journey reflects years of collaboration, creativity, and
                                dedication to helping brands stand out online.
                            </p>
                        </div>
                    </div>
                </div>
                <div className="md:border-x border-r border-border">
                    <Timeline items={timelineData} />
                </div>
                <div className="border-x border-t border-border h-18 md:h-28" />
            </div>
        </section>
    );
};

export default TimelineBlock01;
