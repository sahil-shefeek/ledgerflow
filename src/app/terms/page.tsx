import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function TermsOfService() {
    return (
        <div className="container mx-auto py-10 px-4 max-w-4xl">
            <Card>
                <CardHeader>
                    <CardTitle className="text-3xl font-bold text-center">Terms of Service</CardTitle>
                </CardHeader>
                <CardContent className="prose dark:prose-invert max-w-none space-y-6">
                    <p className="text-muted-foreground text-center">Last updated: {new Date().toLocaleDateString()}</p>

                    <section>
                        <h2 className="text-xl font-semibold mb-2">1. Agreement to Terms</h2>
                        <p>
                            These Terms of Service constitute a legally binding agreement made between you, whether personally or on behalf of an entity ("you") and LedgerFlow ("we," "us," or "our"), concerning your access to and use of the LedgerFlow application.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold mb-2">2. User Representations</h2>
                        <p>
                            By using the Site, you represent and warrant that: (1) all registration information you submit will be true, accurate, current, and complete; (2) you will maintain the accuracy of such information; (3) you have the legal capacity and you agree to comply with these Terms of Service.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold mb-2">3. User Registration</h2>
                        <p>
                            You may be required to register with the Site. You agree to keep your password confidential and will be responsible for all use of your account and password. We reserve the right to remove, reclaim, or change a username you select if we determine in our sole discretion that such username is inappropriate, obscene, or otherwise objectionable.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold mb-2">4. Prohibited Activities</h2>
                        <p>
                            You may not access or use the Site for any purpose other than that for which we make the Site available. The Site may not be used in connection with any commercial endeavors except those that are specifically endorsed or approved by us.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold mb-2">5. Intellectual Property Rights</h2>
                        <p>
                            Unless otherwise indicated, the Site is our proprietary property and all source code, databases, functionality, software, website designs, audio, video, text, photographs, and graphics on the Site (collectively, the "Content") and the trademarks, service marks, and logos contained therein (the "Marks") are owned or controlled by us or licensed to us.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold mb-2">6. Modifications and Interruptions</h2>
                        <p>
                            We reserve the right to change, modify, or remove the contents of the Site at any time or for any reason at our sole discretion without notice. We also reserve the right to modify or discontinue all or part of the Site without notice at any time.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold mb-2">7. Contact Us</h2>
                        <p>
                            In order to resolve a complaint regarding the Site or to receive further information regarding use of the Site, please contact us at support@ledgerflow.app.
                        </p>
                    </section>
                </CardContent>
            </Card>

            <div className="text-center mt-8">
                <a href="/" className="text-muted-foreground hover:text-primary transition-colors">← Back to Home</a>
            </div>
        </div>
    );
}
