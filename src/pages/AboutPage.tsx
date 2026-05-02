import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import CmsRenderer from "@/components/CmsRenderer";
import { Heart, Globe, Shield, Users, PawPrint } from "lucide-react";

const AboutPage = () => {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <CmsRenderer slug="about" fallback={
        <>
      {/* Hero */}
      <div className="bg-gradient-to-br from-primary/10 via-background to-accent/10 py-20">
        <div className="container max-w-3xl text-center">
          <PawPrint className="mx-auto h-12 w-12 text-primary" />
          <h1 className="mt-4 font-display text-4xl font-bold text-foreground md:text-5xl">
            About PetsRegistry.org
          </h1>
          <p className="mt-4 text-lg text-muted-foreground">
            A Global Identity for Every Pet
          </p>
        </div>
      </div>

      <div className="container max-w-3xl py-16 space-y-16">
        {/* Mission */}
        <section>
          <div className="flex items-center gap-3 mb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <Globe className="h-5 w-5 text-primary" />
            </div>
            <h2 className="font-display text-2xl font-bold text-foreground">Our Mission</h2>
          </div>
          <p className="text-muted-foreground leading-relaxed">
            At PetsRegistry.org, we believe that every pet deserves a name that is recognized everywhere and a safety net that never fails. Our platform was born out of a simple, heartfelt goal: to ensure that no beloved pet is ever truly lost. By providing a digital identity to pets around the world, we are building a global community of owners dedicated to the safety, well-being, and lifelong protection of their animal companions.
          </p>
        </section>

        {/* Why We Started */}
        <section>
          <div className="flex items-center gap-3 mb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10">
              <Heart className="h-5 w-5 text-accent" />
            </div>
            <h2 className="font-display text-2xl font-bold text-foreground">Why We Started</h2>
          </div>
          <div className="space-y-4 text-muted-foreground leading-relaxed">
            <p>
              Losing a pet is a heartbreaking experience that no owner should have to endure. Traditional tags can fall off, and local databases are often disconnected. We saw a need for a universal, accessible, and permanent registry that travels with your pet, wherever life takes you.
            </p>
            <p>
              We didn't just build a database; we built a promise. A promise that through technology and community, we can bring lost pets home faster and give owners the peace of mind they deserve.
            </p>
          </div>
        </section>

        {/* What We Provide */}
        <section>
          <div className="flex items-center gap-3 mb-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <Shield className="h-5 w-5 text-primary" />
            </div>
            <h2 className="font-display text-2xl font-bold text-foreground">What We Provide</h2>
          </div>
          <div className="grid gap-6 sm:grid-cols-3">
            <div className="rounded-2xl border border-border bg-card p-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 mb-3">
                <PawPrint className="h-5 w-5 text-primary" />
              </div>
              <h3 className="font-display font-semibold text-foreground">A Unique Global ID</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Every pet registered on our platform receives a unique digital identity, a "Passport of Love" that stores vital information and owner contact details.
              </p>
            </div>
            <div className="rounded-2xl border border-border bg-card p-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10 mb-3">
                <Shield className="h-5 w-5 text-accent" />
              </div>
              <h3 className="font-display font-semibold text-foreground">Lost &amp; Found Security</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Our registry acts as a primary resource for rescuers and finders to quickly identify a pet and reunite them with their family.
              </p>
            </div>
            <div className="rounded-2xl border border-border bg-card p-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 mb-3">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <h3 className="font-display font-semibold text-foreground">A Community of Love</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                We are recommended by pet lovers across the globe. When you register with us, you aren't just a user—you are part of a worldwide movement to protect our furry, feathered, and scaled friends.
              </p>
            </div>
          </div>
        </section>

        {/* Built With Love */}
        <section className="rounded-2xl border border-border bg-card p-8 text-center">
          <Heart className="mx-auto h-10 w-10 text-destructive" />
          <h2 className="mt-4 font-display text-2xl font-bold text-foreground">Built With Love</h2>
          <p className="mt-4 text-muted-foreground leading-relaxed max-w-xl mx-auto">
            PetsRegistry.org was created for owners, by owners. We understand the deep bond between a human and their pet. That's why our platform is designed to be intuitive, secure, and—above all—filled with the same love you give to your pets every day.
          </p>
          <p className="mt-6 font-display text-lg font-semibold text-primary">
            Join our global family today. Give your pet the identity they deserve.
          </p>
        </section>
      </div>

        </>
      } />
      <Footer />
    </div>
  );
};

export default AboutPage;
