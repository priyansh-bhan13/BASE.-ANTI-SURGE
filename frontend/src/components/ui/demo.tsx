// src/components/ui/demo.tsx
import { RideBookingForm, RideDetails } from "@/components/ui/ride-booking-form";

export const Demo = () => {
  // Handler for the form submission
  const handleSearch = (details: RideDetails) => {
    console.log("Searching for a ride with details:", details);
    alert(`Searching from ${details.pickup} to ${details.dropoff} (Distance: ${details.distanceKm} km at ₹24/km = ₹${details.fare})`);
  };

  return (
    <div className="flex items-center justify-center w-full min-h-screen bg-neutral-100">
      <RideBookingForm
        imageUrl="https://images.unsplash.com/photo-1449965408869-eaa3f722e40d?auto=format&fit=crop&w=1200&q=80"
        city="Chandigarh, IN"
        onSearch={handleSearch}
        className="my-8"
      />
    </div>
  );
};

export default Demo;
