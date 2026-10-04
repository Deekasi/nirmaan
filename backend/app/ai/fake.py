"""Realistic placeholder AI answers, used when no Gemini key is set and in tests."""
from app.ai import schemas as s

SOURCES = [
    {"title": "Example market report (demo data)", "url": "https://example.com/market-report",
     "content": "Demo snippet: digital feedback tools are spreading across colleges and hostels."},
    {"title": "Example user discussion (demo data)", "url": "https://forum.example.com/discussion",
     "content": "Demo snippet: students say paper feedback forms are ignored."},
    {"title": "Example news article (demo data)", "url": "https://news.example.com/article",
     "content": "Demo snippet: campuses invest in student experience apps."},
]

QUERIES = [
    "hostel mess food feedback app",
    "student complaints mess food feedback forms",
    "campus food service digital feedback India 2026",
    "college hostel app startup news",
]


def response_for(schema):
    if schema is s.Research:
        return s.Research(
            summary="Demo data: digital feedback tools are spreading on campuses [1], but most target large organisations rather than small groups like hostels [3]. Students say paper forms are ignored [2].",
            market_trend="Growing. More institutions collect feedback digitally [1][3], and students expect quick mobile-first tools.",
            competitors=[
                s.Competitor(name="Google Forms", what_they_do="Generic surveys [1]", weakness="No dashboards, no follow-up on issues"),
                s.Competitor(name="Typeform", what_they_do="Polished forms", weakness="Paid plans; not built for daily ratings"),
                s.Competitor(name="SurveyMonkey", what_they_do="Survey platform", weakness="Overkill and costly for small groups"),
            ],
            user_complaints=[
                "Feedback goes nowhere; nobody sees changes [2]",
                "Forms are long and annoying to fill daily",
                "No way to see trends over time",
            ],
            opportunities=[
                "A 10-second daily rating flow",
                "A simple dashboard showing what to fix first",
            ],
        )
    if schema is s.Validation:
        return s.Validation(
            target_user="Hostel students and the warden or mess committee who manages food quality.",
            problem_statement="Students have no quick way to report food quality, so problems repeat and nobody can see which meals need fixing.",
            unique_angle="Daily one-tap ratings with a ranked 'fix this first' list for the warden, instead of long generic surveys.",
            risks=["Students may stop rating after the first week", "Warden may not act on the data"],
            feasibility_score=8,
            verdict="go",
            verdict_reason="Small, clear scope that a student can build in weeks, with a real user group nearby to test with.",
        )
    if schema is s.Plan:
        return s.Plan(
            features=[
                s.Feature(name="Daily meal rating", description="Rate breakfast, lunch and dinner from 1 to 5", priority="must"),
                s.Feature(name="Comment box", description="Optional short comment with each rating", priority="must"),
                s.Feature(name="Warden dashboard", description="Average rating per meal and the worst meals this week", priority="must"),
                s.Feature(name="Anonymous mode", description="Rate without showing your name", priority="nice"),
                s.Feature(name="Weekly email summary", description="Automatic summary to the mess committee", priority="nice"),
                s.Feature(name="Menu upload", description="Warden posts the weekly menu", priority="later"),
            ],
            recommended_template="webapp",
            template_reason="Users need to submit and view saved ratings, which needs a backend and database.",
            tech_stack=[
                s.StackChoice(layer="Backend", choice="FastAPI", why="Simple Python API with automatic docs"),
                s.StackChoice(layer="Database", choice="SQLite", why="Zero setup, perfect for a first version"),
                s.StackChoice(layer="Frontend", choice="HTML + JavaScript", why="No build step, easy to understand"),
                s.StackChoice(layer="Hosting", choice="Render", why="Free tier, deploys from GitHub"),
            ],
            beginner_explanation="The website shows a form. When you submit a rating, the browser sends it to a small Python server, which saves it in a database file. The dashboard asks the server for all ratings and shows averages.",
            viva_questions=[
                s.VivaQuestion(question="Why did you choose FastAPI?", answer="It is fast to build with, validates input automatically and generates API docs."),
                s.VivaQuestion(question="Why SQLite instead of MySQL?", answer="It needs no server for a first version; I can switch to PostgreSQL later by changing the connection URL."),
                s.VivaQuestion(question="How do you stop fake or spam ratings?", answer="In the next version: login with college email and one rating per meal per user."),
                s.VivaQuestion(question="How is data sent from the browser to the server?", answer="The page uses fetch() to send JSON to REST endpoints, and the server replies with JSON."),
                s.VivaQuestion(question="What would you add next?", answer="Anonymous mode and a weekly summary for the mess committee."),
            ],
        )
    if schema is s.BaseProjectConfig:
        return s.BaseProjectConfig(
            app_name="MessMate",
            tagline="Rate today's mess food in 10 seconds",
            description="MessMate helps hostel students rate every meal and shows the mess committee exactly what to fix first.",
            audience="Hostel students and mess committees",
            primary_color="#2B6CB0",
            features=[
                s.FeatureCard(title="Daily meal rating", description="Rate breakfast, lunch and dinner in one tap."),
                s.FeatureCard(title="Comment box", description="Say what was good or what went wrong."),
                s.FeatureCard(title="Warden dashboard", description="See the lowest-rated meals at a glance."),
            ],
            entity_name="rating",
            entity_plural="ratings",
            chatbot_persona="You are MessMate, a friendly assistant that helps hostel students give clear, polite feedback about mess food.",
        )
    if schema is s.SearchPlan:
        return s.SearchPlan(queries=QUERIES)
    raise ValueError(f"No fake response for {schema.__name__}")
