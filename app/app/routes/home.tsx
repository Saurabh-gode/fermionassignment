import { useState } from "react";
import type { Route } from "./+types/home";
import { useNavigate } from "react-router";

export function meta({ }: Route.MetaArgs) {
  return [
    { title: "New React Router App" },
    { name: "description", content: "Welcome to React Router!" },
  ];
}

export default function Home() {
  let navigate = useNavigate();
  const [meetingId, setMeetingId] = useState("");

  const handleCreateMeeting = () => {
    console.log("Creating new meeting...");
    navigate("/meet/");
  };
  
  const handleJoinMeeting = () => {
    if (meetingId.trim()) {
      console.log("Joining meeting:", meetingId);
      // navigate("/logout");
      navigate(`/meet/${meetingId}`);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6">
      <h1 className="text-3xl font-bold mb-8">Welcome to Fermion Meeting App</h1>

      <div className="mb-4">
        <button
          onClick={handleCreateMeeting}
          className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
        >
          Create New Meeting
        </button>
      </div>

      <div className="flex items-center gap-2">
        <input
          type="text"
          placeholder="Enter Meeting ID"
          value={meetingId}
          onChange={(e) => setMeetingId(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          onClick={handleJoinMeeting}
          disabled={!meetingId.trim()}
          className={`px-6 py-2 rounded transition text-white ${meetingId.trim()
              ? "bg-green-600 hover:bg-green-700"
              : "bg-gray-400 cursor-not-allowed"
            }`}
        >
          Join
        </button>
      </div>
    </div>
  );
}
