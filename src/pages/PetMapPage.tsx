import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import CmsRenderer from "@/components/CmsRenderer";
import PetMap from "@/components/PetMap";

const PetMapPage = () => {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Navbar />
      <CmsRenderer slug="pet-map" fallback={
        <main className="flex-1">
          <PetMap />
        </main>
      } />
      <Footer />
    </div>
  );
};

export default PetMapPage;
