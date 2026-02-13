import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function PrivacyPolicy() {
    return (
        <div className="container mx-auto py-10 px-4 max-w-4xl">
            <Card>
                <CardHeader>
                    <CardTitle className="text-3xl font-bold text-center">Privacy Policy</CardTitle>
                </CardHeader>
                <CardContent className="prose dark:prose-invert max-w-none space-y-6">
                    <p className="text-muted-foreground text-center">Last updated: {new Date().toLocaleDateString()}</p>

                    <section>
                        <h2 className="text-xl font-semibold mb-2">1. Introduction</h2>
                        <p>
                            Welcome to LedgerFlow ("we," "our," or "us"). We are committed to protecting your personal information and your right to privacy.
                            This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our web application.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold mb-2">2. Information We Collect</h2>
                        <p>
                            We collect personal information that you voluntarily provide to us when you register on the application, expressed an interest in obtaining information about us or our products and services, when you participate in activities on the application, or otherwise when you contact us.
                        </p>
                        <ul className="list-disc pl-6 space-y-1 mt-2">
                            <li><strong>Personal Information:</strong> Name, email address, phone number, and profile picture.</li>
                            <li><strong>Financial Data:</strong> Transaction history, account balances, and other financial records you input into the system.</li>
                            <li><strong>OAuth Data:</strong> We access your basic profile information (name, email, photo) from Google when you sign in using Google OAuth.</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold mb-2">3. How We Use Your Information</h2>
                        <p>We use the information we collect or receive:</p>
                        <ul className="list-disc pl-6 space-y-1 mt-2">
                            <li>To facilitate account creation and logon process.</li>
                            <li>To manage your financial records and provide business insights.</li>
                            <li>To send you administrative information.</li>
                            <li>To protect our services (e.g., fraud monitoring and prevention).</li>
                            <li>To enforce our terms, conditions, and policies.</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold mb-2">4. Sharing Your Information</h2>
                        <p>
                            We only share information with your consent, to comply with laws, to provide you with services, to protect your rights, or to fulfill business obligations. We do not sell your personal data to third parties.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold mb-2">5. Data Security</h2>
                        <p>
                            We implement appropriate technical and organizational security measures tailored to the risk of processing your personal information. However, please also remember that we cannot guarantee that the internet itself is 100% secure.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold mb-2">6. Google User Data</h2>
                        <p>
                            If you choose to sign in with Google, we access your Google user data (specifically: name, email, profile picture) solely for authentication and profile creation purposes. We detailed in the "Information We Collect" section, we do not share this data with third parties for advertising purposes.
                        </p>
                        <p className="mt-2">
                            App use of information received, and transfer of information to any other app, from Google APIs will adhere to <a href="https://developers.google.com/terms/api-services-user-data-policy#additional_requirements_for_specific_api_scopes" className="text-primary hover:underline" target="_blank" rel="noopener noreferrer">Google API Services User Data Policy</a>, including the Limited Use requirements.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold mb-2">7. Contact Us</h2>
                        <p>
                            If you have questions or comments about this policy, you may contact us by email at support@ledgerflow.app.
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
