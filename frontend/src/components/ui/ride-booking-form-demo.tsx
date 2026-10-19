import { RideBookingForm } from "@/components/ui/ride-booking-form";

const Demo = () => {
  const handleSearch = (details: {
    pickup: string;
    dropoff: string;
    date: string;
    time: string;
  }) => {
    console.log("Searching for a ride with details:", details);
  };

  return (
    <div className="flex items-center justify-center w-full min-h-screen bg-[#FAFAFA]">
      <RideBookingForm
        imageUrl="https://images.unsplash.com/photo-1449965408869-eaa3f722e40d?auto=format&fit=crop&w=1400&q=80"
        city="Mumbai, IN"
        onSearch={handleSearch}
        className="my-8"
      />
    </div>
  );
};

export default Demo;
