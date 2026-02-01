import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Mail, Lock, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

export default function Auth() {
    const navigate = useNavigate();
    const [isLoading, setIsLoading] = useState(false);
    const [isSignUp, setIsSignUp] = useState(false);
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");

    // Check if already logged in
    useEffect(() => {
        supabase.auth.getUser().then(({ data: { user } }) => {
            if (user) navigate("/");
        });
    }, [navigate]);

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        try {
            if (isSignUp) {
                const { error } = await supabase.auth.signUp({
                    email,
                    password,
                });
                if (error) throw error;
                toast.success("Account created! You can now log in.");
                setIsSignUp(false); // Switch to login view
            } else {
                const { error } = await supabase.auth.signInWithPassword({
                    email,
                    password,
                });
                if (error) throw error;
                toast.success("Welcome back!");
                navigate("/");
                window.location.reload(); // Ensure all states refresh
            }
        } catch (error: any) {
            toast.error(error.message || "Authentication failed");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
            <Button
                variant="ghost"
                className="absolute top-4 left-4 text-zinc-400 hover:text-white"
                onClick={() => navigate("/")}
            >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Dashboard
            </Button>

            <Card className="w-full max-w-md bg-zinc-900 border-zinc-800 text-zinc-100">
                <CardHeader>
                    <CardTitle className="text-2xl text-center">
                        {isSignUp ? "Create Account" : "Welcome Back"}
                    </CardTitle>
                    <CardDescription className="text-center text-zinc-400">
                        {isSignUp
                            ? "Enter your details to create a new account"
                            : "Enter your credentials to access your account"}
                    </CardDescription>
                </CardHeader>
                <form onSubmit={handleAuth}>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="email">Email</Label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-3 h-4 w-4 text-zinc-500" />
                                <Input
                                    id="email"
                                    type="email"
                                    placeholder="name@example.com"
                                    className="pl-9 bg-zinc-950 border-zinc-800 focus:ring-zinc-700"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="password">Password</Label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-3 h-4 w-4 text-zinc-500" />
                                <Input
                                    id="password"
                                    type="password"
                                    placeholder="••••••••"
                                    className="pl-9 bg-zinc-950 border-zinc-800 focus:ring-zinc-700"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    minLength={6}
                                />
                            </div>
                        </div>
                    </CardContent>
                    <CardFooter className="flex flex-col gap-4">
                        <Button
                            type="submit"
                            className="w-full bg-white text-zinc-950 hover:bg-zinc-200"
                            disabled={isLoading}
                        >
                            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {isSignUp ? "Sign Up" : "Sign In"}
                        </Button>
                        <p className="text-sm text-center text-zinc-500">
                            {isSignUp ? "Already have an account?" : "Don't have an account?"}
                            <button
                                type="button"
                                className="ml-1 text-zinc-300 hover:underline hover:text-white"
                                onClick={() => setIsSignUp(!isSignUp)}
                            >
                                {isSignUp ? "Sign In" : "Sign Up"}
                            </button>
                        </p>
                    </CardFooter>
                </form>
            </Card>
        </div>
    );
}
