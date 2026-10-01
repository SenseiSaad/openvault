"""Seed rich demo data for the OpenVault public knowledge library.

Creates a Django superuser, several publisher institutions (companies), their
admin/employee users, and ~50 realistic public documents spanning 30 subject
genres (Technology, Biology, Agriculture, Climate, Economics, ...). Each
document is written to disk and indexed offline so search + previews work
without a running LLM.

Idempotent — safe to re-run (uses get_or_create). For a clean rebuild, delete
backend/db.sqlite3 and run again.
"""
import os
import uuid
from datetime import timedelta

from django.conf import settings
from django.core.management.base import BaseCommand
from django.utils import timezone

from core import rag
from core.models import Company, User, Document, DocumentShare


# publisher slug -> (display name, [documents])
# each document: (filename, category, downloads, days_ago, description, is_public, is_okf, body)
DEMO = {
    # ============================================ Tech Press Review
    "techpress": ("Tech Press Review", [
        ("State of Cloud Computing 2025.md", "Technology", 1284, 45,
         "An industry survey of cloud adoption, spend and multi-cloud strategy across 2,400 organisations.",
         True, False,
         "State of Cloud Computing 2025\n\nCloud spending grew 21% year over year, with 78% of "
         "surveyed organisations now running workloads across two or more providers. Cost "
         "optimisation overtook security as the top concern for the first time. Kubernetes remains "
         "the default orchestration layer, while serverless adoption is strongest among teams "
         "under fifty engineers. FinOps practices correlated with a 15% reduction in idle spend."),
        ("A Practical Introduction to Large Language Models.md", "Artificial Intelligence", 3120, 20,
         "How transformer-based language models are trained, prompted and evaluated in practice.",
         True, False,
         "A Practical Introduction to Large Language Models\n\nLarge language models are trained to "
         "predict the next token over trillions of words of text. Their capabilities emerge from "
         "scale, but reliable behaviour comes from instruction tuning and alignment. This guide "
         "covers tokenisation, context windows, temperature, retrieval-augmented generation and the "
         "evaluation of factual accuracy. Prompt design remains the cheapest lever for quality."),
        ("Zero Trust Architecture: A Field Guide.md", "Cybersecurity", 1890, 15,
         "Designing networks that never implicitly trust a request, whatever its origin.",
         True, False,
         "Zero Trust Architecture\n\nZero trust replaces the perimeter model with per-request "
         "verification of identity, device posture and context. Every access decision is "
         "authenticated, authorised and encrypted, and no network location is inherently trusted. "
         "Practical rollout starts with strong identity, micro-segmentation and continuous logging. "
         "Least privilege and short-lived credentials limit the blast radius of any single breach."),
        ("Clean Code Principles for Modern Teams.md", "Software Engineering", 2450, 30,
         "Readable, testable, changeable code — the habits that keep a codebase healthy at scale.",
         True, False,
         "Clean Code Principles for Modern Teams\n\nCode is read far more often than it is written, so "
         "clarity beats cleverness. Prefer small functions that do one thing, names that reveal intent, "
         "and tests that document behaviour. Duplication is a liability; premature abstraction is worse. "
         "Refactor continuously in small, safe steps, and treat every code review as shared learning."),
        ("Systems Design Interview Handbook.md", "Engineering", 2760, 10,
         "A structured approach to designing scalable systems under real-world constraints.",
         True, False,
         "Systems Design Interview Handbook\n\nStart from requirements: traffic, data volume, latency "
         "and consistency needs. Estimate load before choosing components. Discuss trade-offs between "
         "SQL and NoSQL, caching layers, message queues and replication. Design for failure with "
         "redundancy and graceful degradation. Communicate assumptions clearly and iterate on the "
         "bottleneck rather than gold-plating the whole design."),
        ("Feature Engineering for Tabular Data.md", "Data Science", 980, 60,
         "Turning raw columns into predictive signal for classical machine-learning models.",
         True, False,
         "Feature Engineering for Tabular Data\n\nGood features often matter more than model choice. "
         "Handle missing values deliberately, encode categoricals by cardinality, and derive ratios and "
         "aggregates that capture domain knowledge. Watch for leakage from features that would not exist "
         "at prediction time. Validate with a scheme that mirrors production, and prefer simple, robust "
         "transforms that a model can exploit without overfitting."),
        ("Transformer Networks Explained.md", "Artificial Intelligence", 4010, 5,
         "The attention mechanism that powers modern language and vision models, from scratch.",
         True, False,
         "Transformer Networks Explained\n\nThe transformer replaces recurrence with self-attention, "
         "letting every token attend directly to every other token. Multi-head attention learns "
         "different relationships in parallel, while positional encodings restore word order. Stacked "
         "attention and feed-forward blocks, with residual connections and layer normalisation, scale "
         "to billions of parameters. This architecture underpins nearly all state-of-the-art models."),
        ("OKF: Editorial Review Standards.md", "Technology", 0, 4,
         "Internal curated note always injected into AI answers for editorial staff.",
         False, True,
         "OKF: Editorial Review Standards\n\nEvery published article requires two independent reviewers. "
         "Never cite a preprint as settled fact. Disclose funding sources. Corrections are issued "
         "publicly within 24 hours of a confirmed error. Do not promise coverage of unreleased products."),
    ]),
    # ============================================ Open Science Foundation
    "openscience": ("Open Science Foundation", [
        ("An Introduction to Quantum Mechanics.md", "Physics", 1560, 90,
         "Wavefunctions, superposition and measurement for the scientifically curious reader.",
         True, False,
         "An Introduction to Quantum Mechanics\n\nQuantum mechanics describes matter and energy at the "
         "smallest scales, where particles behave as probability waves. Superposition allows a system to "
         "occupy many states at once until measured, and entanglement links particles across distance. "
         "The Schrodinger equation governs how these states evolve. Counter-intuitive yet exquisitely "
         "tested, quantum theory underlies chemistry, semiconductors and emerging quantum computers."),
        ("Green Chemistry: Principles and Practice.md", "Chemistry", 640, 120,
         "Designing chemical processes that reduce waste, energy use and hazardous substances.",
         True, False,
         "Green Chemistry\n\nGreen chemistry seeks to prevent pollution at the molecular level. Its "
         "twelve principles favour atom economy, safer solvents, renewable feedstocks and catalytic "
         "over stoichiometric reagents. Designing for degradation avoids persistent pollutants. Real-time "
         "monitoring reduces accidents. Together these ideas cut cost and environmental harm at once."),
        ("Linear Algebra Done Visually.md", "Mathematics", 2210, 25,
         "Vectors, matrices and transformations built up from geometric intuition.",
         True, False,
         "Linear Algebra Done Visually\n\nLinear algebra is the mathematics of vectors and the linear "
         "transformations that act on them. Matrices are best understood as functions that stretch, "
         "rotate and project space. Eigenvectors are the directions a transformation leaves unchanged. "
         "This geometric view demystifies determinants, rank and the dot product, and grounds "
         "applications from computer graphics to machine learning."),
        ("Exoplanets and the Search for Life.md", "Astronomy", 1730, 18,
         "How astronomers detect planets around distant stars and probe their atmospheres.",
         True, False,
         "Exoplanets and the Search for Life\n\nMost known exoplanets were found by watching a star dim "
         "as a planet transits, or wobble under a planet's gravity. Thousands are now catalogued, some in "
         "the habitable zone where liquid water could exist. Spectroscopy of starlight filtered through a "
         "planet's atmosphere hunts for water, methane and oxygen. Biosignatures remain unconfirmed but "
         "within reach of the next generation of telescopes."),
        ("Reproducible Research with Open Data.md", "Data Science", 720, 70,
         "Practices that let anyone rerun your analysis and get the same result.",
         True, False,
         "Reproducible Research with Open Data\n\nReproducibility begins with version control, pinned "
         "dependencies and scripted analysis rather than manual steps. Share data with clear licences "
         "and documented provenance. Record random seeds and computing environments. Preregistration "
         "guards against hidden flexibility in the analysis. Open, reproducible work is cited more and "
         "trusted longer."),
        ("Scientific Computing with Python.md", "Software Engineering", 1340, 40,
         "NumPy, vectorisation and numerical stability for research code that has to be correct.",
         True, False,
         "Scientific Computing with Python\n\nVectorised array operations in NumPy replace slow Python "
         "loops and express intent clearly. Understand floating-point limits: catastrophic cancellation "
         "and accumulation of error can silently ruin a result. Profile before optimising, and validate "
         "against analytic cases. Well-tested, readable research code is a scientific instrument in its "
         "own right and deserves the same rigour as the experiment."),
        ("Thermodynamics: From Steam Engines to Black Holes.md", "Physics", 890, 200,
         "The laws of energy, entropy and the arrow of time, from engines to cosmology.",
         True, False,
         "Thermodynamics\n\nThe first law conserves energy; the second states that entropy, or disorder, "
         "tends to increase in an isolated system. Together they set the limits of every engine and "
         "refrigerator. Entropy gives time its direction and even governs the thermodynamics of black "
         "holes, whose temperature and entropy link gravity to quantum theory. Few frameworks in physics "
         "are so universal."),
        ("OKF: Peer Review Guidelines.md", "Research", 0, 6,
         "Internal curated reviewing standards, always available to editorial staff.",
         False, True,
         "OKF: Peer Review Guidelines\n\nReviews are double-blind. Judge methodology, not conclusions. "
         "Flag missing data or code availability. Declare conflicts of interest. Recommend rejection "
         "only with specific, actionable reasons. Turn reviews around within three weeks."),
        ("Internal: 2025 Grant Roadmap.md", "Research", 0, 9,
         "Private planning document for the foundation's funding programmes.",
         False, False,
         "Internal: 2025 Grant Roadmap\n\nPriority areas this cycle: open climate data, reproducible AI "
         "benchmarks and public-health surveillance. Two funding rounds in Q2 and Q4. Maximum award "
         "$250k over two years. Not for external distribution."),
    ]),
    # ============================================ Global Health Archive
    "medarchive": ("Global Health Archive", [
        ("Evidence-Based Medicine: A Clinician's Primer.md", "Medicine", 2980, 12,
         "Turning research evidence into sound decisions at the bedside.",
         True, False,
         "Evidence-Based Medicine\n\nEvidence-based medicine integrates the best available research, "
         "clinical expertise and patient values. The hierarchy of evidence places systematic reviews and "
         "randomised trials above observational studies and expert opinion. Clinicians must appraise "
         "study quality, effect size and applicability to the patient in front of them. Statistical "
         "significance is not the same as clinical importance."),
        ("The Neuroscience of Memory and Learning.md", "Neuroscience", 1620, 33,
         "How the brain encodes, consolidates and retrieves memories.",
         True, False,
         "The Neuroscience of Memory and Learning\n\nMemories form as networks of neurons strengthen "
         "their connections, a process called synaptic plasticity. The hippocampus binds new episodic "
         "memories, which are gradually consolidated into the cortex, especially during sleep. Retrieval "
         "is reconstructive, not a perfect replay, which is why memories can change over time. Spacing "
         "and active recall exploit these mechanisms to make learning durable."),
        ("CRISPR Gene Editing: Mechanisms and Ethics.md", "Genetics", 2140, 22,
         "The molecular scissors reshaping biology, and the questions they raise.",
         True, False,
         "CRISPR Gene Editing\n\nCRISPR-Cas9 uses a guide RNA to direct a cutting enzyme to a precise DNA "
         "sequence, where the cell's repair machinery can disable or rewrite a gene. It has transformed "
         "research and enabled therapies for sickle-cell disease and inherited blindness. Editing human "
         "embryos, however, raises profound ethical questions about consent, equity and heritable change "
         "that science alone cannot answer."),
        ("Cell Biology: The Fundamentals.md", "Biology", 1180, 88,
         "The structures and processes shared by every living cell.",
         True, False,
         "Cell Biology: The Fundamentals\n\nThe cell is the basic unit of life. Membranes separate the "
         "interior from the environment while controlling what enters and leaves. Organelles divide "
         "labour: mitochondria generate energy, ribosomes build proteins, the nucleus stores DNA. "
         "Signalling pathways let cells respond to their surroundings, and tightly regulated division "
         "underlies growth, repair and, when it fails, cancer."),
        ("mRNA Vaccines: From Bench to Bedside.md", "Biotechnology", 3350, 8,
         "How messenger-RNA platforms went from decades of research to global deployment.",
         True, False,
         "mRNA Vaccines\n\nAn mRNA vaccine delivers instructions that prompt cells to make a harmless "
         "fragment of a pathogen, training the immune system without infection. Lipid nanoparticles "
         "protect the fragile RNA and carry it into cells. Decades of quiet research made rapid design "
         "and manufacturing possible during a pandemic. The platform is now being adapted for influenza, "
         "cancer and other diseases."),
        ("Cognitive Behavioural Therapy: An Overview.md", "Psychology", 1950, 44,
         "A structured, evidence-based approach to changing unhelpful thoughts and behaviours.",
         True, False,
         "Cognitive Behavioural Therapy\n\nCBT is built on the idea that thoughts, feelings and behaviours "
         "influence one another. By identifying distorted thinking and testing it against evidence, "
         "patients learn to respond differently to distressing situations. Techniques include thought "
         "records, behavioural experiments and graded exposure. It is among the best-supported treatments "
         "for anxiety and depression, and its skills often outlast the therapy itself."),
        ("Global Antimicrobial Resistance Report.md", "Medicine", 760, 150,
         "The rising threat of drug-resistant infections and what slows it.",
         True, False,
         "Global Antimicrobial Resistance Report\n\nOveruse of antibiotics in medicine and agriculture is "
         "breeding resistant bacteria faster than new drugs are developed. Resistant infections already "
         "cause over a million deaths a year. Stewardship programmes, rapid diagnostics, vaccination and "
         "infection control all slow the spread. Without coordinated action, routine procedures could "
         "again carry serious infection risk."),
    ]),
    # ============================================ AgriTech Institute
    "agritech": ("AgriTech Institute", [
        ("Sustainable Farming Practices Handbook.md", "Agriculture", 1420, 28,
         "Practical methods to keep land productive without depleting it.",
         True, False,
         "Sustainable Farming Practices Handbook\n\nSustainable farming maintains yields while protecting "
         "soil, water and biodiversity. Crop rotation and cover crops rebuild fertility and break pest "
         "cycles. Reduced tillage keeps carbon and moisture in the ground. Integrated pest management "
         "uses chemicals only as a last resort. Matching inputs to need cuts cost and runoff at the same "
         "time."),
        ("Precision Agriculture and IoT Sensors.md", "Agriculture", 980, 16,
         "Using data from the field to apply exactly what each crop needs, where it needs it.",
         True, False,
         "Precision Agriculture\n\nSensors, satellites and GPS-guided machinery let farmers manage fields "
         "at the square-metre scale. Soil-moisture and nutrient data drive variable-rate irrigation and "
         "fertiliser, reducing waste. Drones spot disease and stress before it is visible from the ground. "
         "The payoff is higher yields from fewer inputs, though it demands connectivity and data skills "
         "many rural areas still lack."),
        ("Genetically Modified Crops: Science and Policy.md", "Biotechnology", 870, 100,
         "What genetic modification does, and the debate over how to govern it.",
         True, False,
         "Genetically Modified Crops\n\nGenetic modification inserts specific traits, such as pest "
         "resistance or drought tolerance, into a crop's genome. Decades of study find approved GM foods "
         "as safe to eat as conventional ones, yet debate continues over ecology, corporate control of "
         "seed and labelling. Sound policy weighs evidence of benefit and risk case by case rather than "
         "treating all modification alike."),
        ("Vertical Farming: Growing Up.md", "Agriculture", 1120, 9,
         "Stacked, controlled-environment agriculture in and near cities.",
         True, False,
         "Vertical Farming\n\nVertical farms grow crops in stacked layers under LED light with precisely "
         "controlled climate and nutrients. They use a fraction of the land and water of open fields and "
         "can sit inside cities, cutting transport. Energy for lighting is the main cost and constraint. "
         "The model suits leafy greens and herbs today, with fruiting crops an active research frontier."),
    ]),
    # ============================================ Gaia Earth Lab
    "gaia-lab": ("Gaia Earth Lab", [
        ("Climate Change 2025: The Physical Science Basis.md", "Climate", 4200, 6,
         "A synthesis of the observed and projected physical changes to the climate system.",
         True, False,
         "Climate Change 2025: The Physical Science Basis\n\nGlobal surface temperature is now about 1.2C "
         "above pre-industrial levels, driven overwhelmingly by human greenhouse-gas emissions. Warming "
         "is intensifying heatwaves, heavy rainfall and sea-level rise. Every fraction of a degree "
         "avoided reduces harm. Limiting warming to 1.5C requires roughly halving emissions this decade "
         "and reaching net zero around mid-century."),
        ("Biodiversity Loss and Ecosystem Services.md", "Environmental Science", 1290, 48,
         "Why the decline of species matters for the systems people depend on.",
         True, False,
         "Biodiversity Loss and Ecosystem Services\n\nSpecies are disappearing tens to hundreds of times "
         "faster than the natural background rate, mainly from habitat loss, overexploitation and climate "
         "change. Biodiversity underpins pollination, clean water, fisheries and carbon storage, services "
         "worth trillions. Protecting and restoring habitat, and connecting fragmented landscapes, are the "
         "most effective responses."),
        ("The Global Transition to Renewable Energy.md", "Energy", 2360, 14,
         "How wind, solar and storage are reshaping the power system.",
         True, False,
         "The Global Transition to Renewable Energy\n\nSolar and wind are now the cheapest sources of new "
         "electricity in most of the world. Their variability shifts the challenge from generation to "
         "flexibility: storage, demand response and stronger grids. Electrifying transport and heating "
         "raises demand even as it cuts emissions. The transition is as much about markets and grids as "
         "about the turbines and panels themselves."),
        ("Grid-Scale Battery Storage Explained.md", "Energy", 980, 26,
         "The technologies that let a renewable grid keep the lights on after dark.",
         True, False,
         "Grid-Scale Battery Storage\n\nLithium-ion batteries dominate grid storage today, smoothing the "
         "gap between variable supply and demand over hours. They provide fast frequency response, defer "
         "costly network upgrades and store surplus solar for the evening peak. For longer durations, "
         "flow batteries, pumped hydro and emerging chemistries compete on cost per stored kilowatt-hour. "
         "Falling prices are accelerating deployment worldwide."),
        ("Carbon Capture and Storage: A Technical Review.md", "Climate", 720, 65,
         "Capturing CO2 from industry and power, and locking it underground.",
         True, False,
         "Carbon Capture and Storage\n\nCCS separates carbon dioxide from flue gas or the air, compresses "
         "it and injects it into deep geological formations for permanent storage. It is one of the few "
         "options for hard-to-abate industries such as cement and steel. Costs and energy penalties remain "
         "high, and public trust in storage sites matters. It complements, rather than replaces, cutting "
         "emissions at the source."),
        ("Ocean Acidification and Marine Life.md", "Environmental Science", 660, 75,
         "How a changing ocean chemistry threatens shell-building organisms and food webs.",
         True, False,
         "Ocean Acidification and Marine Life\n\nThe ocean has absorbed roughly a third of human carbon "
         "emissions, lowering its pH in a process called acidification. More acidic water makes it harder "
         "for corals, shellfish and plankton to build calcium-carbonate shells and skeletons. Because "
         "these organisms anchor marine food webs, the effects ripple up to fisheries. Cutting emissions "
         "is the only durable remedy."),
    ]),
    # ============================================ Humanities Commons
    "humanities": ("Humanities Commons", [
        ("Principles of Behavioural Economics.md", "Economics", 1870, 30,
         "Why real people depart from the rational actor, and what it means for policy.",
         True, False,
         "Principles of Behavioural Economics\n\nBehavioural economics blends psychology with economics to "
         "explain choices that classical theory cannot. People are loss-averse, anchor on irrelevant "
         "numbers and are swayed by how options are framed. Small changes to defaults, or 'nudges', can "
         "shift behaviour without restricting choice. The field reshaped how governments design pensions, "
         "taxes and public-health campaigns."),
        ("A Beginner's Guide to Personal Finance.md", "Finance", 3540, 11,
         "Budgeting, saving, debt and investing explained without jargon.",
         True, False,
         "A Beginner's Guide to Personal Finance\n\nSound personal finance rests on a few durable habits: "
         "spend less than you earn, keep an emergency fund, and clear high-interest debt first. "
         "Compound interest rewards those who invest early and consistently. Low-cost, diversified index "
         "funds beat most active strategies over the long run. Insurance and a will protect what you "
         "build. Simplicity and patience matter more than clever timing."),
        ("Lean Startup Methodology in Practice.md", "Business", 2120, 19,
         "Building companies through fast, cheap experiments instead of big upfront bets.",
         True, False,
         "Lean Startup Methodology\n\nThe lean startup treats a new venture as a series of hypotheses to "
         "test. Build a minimum viable product, measure how customers actually behave, and learn whether "
         "to persevere or pivot. Vanity metrics flatter; actionable metrics guide. The goal is to shorten "
         "the build-measure-learn loop so the company discovers a sustainable model before the money runs "
         "out."),
        ("Introduction to Intellectual Property Law.md", "Law", 940, 58,
         "Patents, copyright, trademarks and trade secrets, and what each protects.",
         True, False,
         "Introduction to Intellectual Property Law\n\nIntellectual property law grants creators limited "
         "rights over their work to encourage innovation. Patents protect inventions, copyright protects "
         "original expression, trademarks protect brand identity and trade secrets protect confidential "
         "know-how. Each has different requirements and durations. The central tension is always between "
         "rewarding creators and keeping knowledge and competition free."),
        ("The Science of Effective Learning.md", "Education", 1680, 21,
         "What cognitive research says actually helps people learn and remember.",
         True, False,
         "The Science of Effective Learning\n\nDecades of research point to a few powerful techniques: "
         "retrieval practice, spacing study over time, and interleaving related topics. These feel harder "
         "than rereading, and that difficulty is exactly why they work. Immediate feedback and explaining "
         "ideas in your own words deepen understanding. Popular notions like fixed 'learning styles' find "
         "little support in the evidence."),
        ("Social Networks and Collective Behaviour.md", "Sociology", 580, 95,
         "How the structure of our connections shapes what spreads through society.",
         True, False,
         "Social Networks and Collective Behaviour\n\nSociety is a web of relationships, and the shape of "
         "that web governs how information, behaviour and disease spread. A few highly connected hubs can "
         "accelerate diffusion, while weak ties bridge otherwise separate groups. Contagion is not only "
         "biological: opinions, norms and panics propagate along the same links. Mapping networks helps "
         "predict tipping points in collective behaviour."),
        ("A Short History of the Industrial Revolution.md", "History", 1350, 130,
         "How steam, factories and cities remade the modern world.",
         True, False,
         "A Short History of the Industrial Revolution\n\nFrom the late 18th century, mechanised "
         "production and the steam engine transformed Britain and then the world. Output soared, cities "
         "swelled and new classes of factory workers emerged, often in harsh conditions. Railways and "
         "the telegraph collapsed distance. The revolution lifted long-run living standards while "
         "unleashing pollution and inequality whose consequences still shape debate today."),
        ("Ethics in the Age of Artificial Intelligence.md", "Philosophy", 1990, 17,
         "Old moral questions made newly urgent by autonomous, learning systems.",
         True, False,
         "Ethics in the Age of Artificial Intelligence\n\nAs machines make consequential decisions, "
         "familiar ethical questions return with force. Who is responsible when an autonomous system "
         "causes harm? How do we ensure fairness when models learn from biased data? What weight should "
         "we give transparency, privacy and human autonomy? These are not merely technical problems; they "
         "demand that engineers and philosophers reason together about the good."),
        ("Principles of Visual Design.md", "Arts & Design", 2280, 23,
         "Hierarchy, contrast, balance and rhythm — the grammar of good design.",
         True, False,
         "Principles of Visual Design\n\nStrong design guides the eye. Visual hierarchy signals what "
         "matters most through size, weight and placement. Contrast creates emphasis; alignment and grids "
         "create order; whitespace gives the composition room to breathe. Colour and typography set tone "
         "and must serve legibility first. These principles are not rules to obey blindly but tools to "
         "communicate clearly."),
        ("The Craft of Narrative Nonfiction.md", "Literature", 870, 140,
         "Telling true stories with the techniques of the novel.",
         True, False,
         "The Craft of Narrative Nonfiction\n\nNarrative nonfiction reports facts with the artistry of "
         "fiction: scene, character, tension and voice. The writer earns trust through rigorous "
         "reporting, then shapes that material into a story with momentum. Detail makes the abstract "
         "concrete; structure controls what the reader feels and when. The discipline is to never invent, "
         "and yet to make the truth as compelling as any tale."),
        ("Understanding Inflation and Monetary Policy.md", "Economics", 1130, 52,
         "What drives prices, and how central banks try to steer them.",
         True, False,
         "Understanding Inflation and Monetary Policy\n\nInflation is a sustained rise in the general "
         "price level, eroding the purchasing power of money. It can stem from strong demand, supply "
         "shocks or expectations that become self-fulfilling. Central banks respond mainly by adjusting "
         "interest rates to cool or stimulate spending. The hard part is timing: policy acts with long "
         "and variable lags, so banks must act on forecasts, not just today's data."),
        ("Data-Driven Decision Making for Managers.md", "Business", 990, 38,
         "Using evidence, not intuition, to run teams and organisations.",
         True, False,
         "Data-Driven Decision Making\n\nData-driven management replaces gut feel with measurement, "
         "experimentation and honest metrics. It starts with asking the right question, then gathering "
         "relevant, trustworthy data and guarding against bias in how it is read. Correlation is not "
         "causation, so controlled experiments matter. The aim is not to remove judgement but to inform "
         "it, and to build a culture where evidence can change minds."),
    ]),
}


# Private enterprise tenants for testing ISOLATION + granular COLLABORATION.
# These are NOT on the public portal (is_public=False). Company A / B / C are
# placeholders you can fill with your own data. Policy numbers differ on purpose
# so you can prove one company's HR cannot see another company's answers.
# each doc: (filename, category, days_ago, description, is_okf, body)
ENTERPRISE = {
    "company-a": ("Company A", [
        ("Leave Policy.md", "HR", 12,
         "Annual, sick and parental leave entitlements for Company A staff.", False,
         "Company A — Leave Policy\n\nFull-time employees receive 20 days of paid annual leave per "
         "year, plus 10 paid sick days. Up to 5 unused annual-leave days may be carried into the next "
         "year. Parental leave is 16 weeks at full pay. Leave requests go through the HR portal and "
         "need manager approval at least 5 working days in advance."),
        ("Expense & Reimbursement Policy.md", "Operations", 20,
         "How Company A staff claim travel and business expenses.", False,
         "Company A — Expense & Reimbursement Policy\n\nMeals while travelling are reimbursed up to $50 "
         "per day. Economy airfare and standard hotel rooms only. Submit receipts through the finance "
         "portal within 14 days of the trip. Any expense over $500 needs prior written approval from a "
         "department head."),
        ("Remote Work Policy.md", "HR", 8,
         "Hybrid working rules at Company A.", False,
         "Company A — Remote Work Policy\n\nEmployees may work remotely up to 3 days per week. Core "
         "collaboration hours are 10:00-16:00 local time, when everyone must be reachable. A quiet, "
         "secure workspace and the company VPN are required on any remote day handling confidential data."),
        ("Code of Conduct.md", "Legal", 40,
         "Expected professional behaviour at Company A.", False,
         "Company A — Code of Conduct\n\nWe treat colleagues, customers and partners with respect. "
         "Harassment and discrimination are never tolerated. Conflicts of interest must be declared. "
         "Company data and customer information are confidential and may not leave approved systems."),
        ("OKF: HR Quick Facts.md", "HR", 3,
         "Curated always-in-context HR facts for Company A.", True,
         "OKF: Company A HR Quick Facts\n\nHR contact: hr@company-a.com. Payday is the 25th of each "
         "month. Probation period is 3 months. Escalate harassment reports directly to the HR lead, "
         "never to the line manager involved. Public holidays follow the national calendar."),
    ]),
    # __ENTERPRISE_APPEND__
    "company-b": ("Company B", [
        ("Leave Policy.md", "HR", 14,
         "Annual, sick and parental leave entitlements for Company B staff.", False,
         "Company B — Leave Policy\n\nFull-time employees receive 18 days of paid annual leave per "
         "year, plus 8 paid sick days. Unused annual leave cannot be carried over and is forfeited at "
         "year end. Parental leave is 12 weeks at full pay. Submit requests to your manager at least a "
         "week ahead."),
        ("Expense & Reimbursement Policy.md", "Operations", 22,
         "How Company B staff claim travel and business expenses.", False,
         "Company B — Expense & Reimbursement Policy\n\nMeals while travelling are reimbursed up to $40 "
         "per day. Book travel through the corporate agent. Submit receipts within 30 days. Expenses "
         "above $300 require finance pre-approval."),
        ("Remote Work Policy.md", "HR", 10,
         "Hybrid working rules at Company B.", False,
         "Company B — Remote Work Policy\n\nEmployees may work remotely up to 2 days per week. Core "
         "hours are 09:00-15:00. Fridays are office days for the whole team. Managers may grant "
         "additional remote days case by case."),
        ("Information Security Basics.md", "Cybersecurity", 30,
         "Baseline security rules every Company B employee must follow.", False,
         "Company B — Information Security Basics\n\nUse the company password manager and enable "
         "multi-factor authentication on every account. Never email confidential files to personal "
         "addresses. Report suspected phishing to security@company-b.com immediately. Laptops must be "
         "encrypted and screen-locked when unattended."),
        ("OKF: HR Quick Facts.md", "HR", 4,
         "Curated always-in-context HR facts for Company B.", True,
         "OKF: Company B HR Quick Facts\n\nHR contact: hr@company-b.com. Payday is the last working day "
         "of the month. Probation period is 6 months. Referral bonus is paid after the referred hire "
         "passes probation."),
    ]),
    "company-c": ("Company C", [
        ("Leave Policy.md", "HR", 11,
         "Annual, sick and parental leave entitlements for Company C staff.", False,
         "Company C — Leave Policy\n\nFull-time employees receive 25 days of paid annual leave per "
         "year, plus 12 paid sick days. Up to 10 unused annual-leave days may be carried over. Parental "
         "leave is 20 weeks at full pay. Company C also offers 3 paid volunteering days per year."),
        ("Expense & Reimbursement Policy.md", "Operations", 25,
         "How Company C staff claim travel and business expenses.", False,
         "Company C — Expense & Reimbursement Policy\n\nMeals while travelling are reimbursed up to $60 "
         "per day. Business-class travel is allowed on flights over six hours. Submit receipts within 21 "
         "days. Client entertainment over $1000 needs director approval."),
        ("Vendor Security Requirements.md", "Cybersecurity", 6,
         "Security controls Company C requires of its partners and vendors.", False,
         "Company C — Vendor Security Requirements\n\nAll vendors handling Company C data must hold a "
         "current SOC 2 Type II report, encrypt data in transit and at rest, and notify Company C of any "
         "breach within 24 hours. Access is granted least-privilege and reviewed quarterly. This document "
         "is shared with partner companies on a need-to-know basis."),
        ("OKF: HR Quick Facts.md", "HR", 5,
         "Curated always-in-context HR facts for Company C.", True,
         "OKF: Company C HR Quick Facts\n\nHR contact: hr@company-c.com. Payday is the 28th. Probation "
         "period is 3 months. Company C runs a 4-day week in August. Escalate benefits questions to the "
         "people-ops team."),
    ]),
}


class Command(BaseCommand):
    help = "Seed demo publishers, users and public knowledge-library documents"

    def _doc(self, company, uploader, spec):
        (name, category, downloads, days_ago, desc, is_public, is_okf, body) = spec
        raw = body.encode("utf-8")
        # write a real file so the demo download button works
        folder = os.path.join(settings.DATA_DIR, company.slug)
        os.makedirs(folder, exist_ok=True)
        stored = os.path.join(folder, f"{uuid.uuid4().hex}_{name}")
        doc, created = Document.objects.get_or_create(
            company=company, filename=name,
            defaults=dict(
                stored_path=stored, content_type="text/markdown", size=len(raw),
                category=category, description=desc, downloads=downloads,
                is_public=is_public, is_okf=is_okf, uploaded_by=uploader,
            ),
        )
        if created:
            with open(stored, "wb") as out:
                out.write(raw)
            rag.index_document(doc, raw)
            # backdate created_at (auto_now_add ignores assignment, so update directly)
            Document.objects.filter(pk=doc.pk).update(
                created_at=timezone.now() - timedelta(days=days_ago)
            )
        return created

    def handle(self, *args, **options):
        # Django superuser for /admin
        if not User.objects.filter(email="root@securekb.local").exists():
            User.objects.create_superuser(
                email="root@securekb.local", password="admin1234", full_name="OpenVault Root",
            )
            self.stdout.write(self.style.SUCCESS(">> superuser root@securekb.local / admin1234"))

        new_docs = 0
        for slug, (name, docs) in DEMO.items():
            company, _ = Company.objects.get_or_create(slug=slug, defaults={"name": name})
            admin_user, created = User.objects.get_or_create(
                email=f"admin@{slug}.com",
                defaults=dict(full_name=f"{name} Admin", role="admin", company=company),
            )
            if created:
                admin_user.set_password("demo1234")
                admin_user.save()
            for spec in docs:
                new_docs += 1 if self._doc(company, admin_user, spec) else 0

        # a demo employee login for the flagship publisher's enterprise workspace
        flagship = Company.objects.get(slug="openscience")
        staff, created = User.objects.get_or_create(
            email="staff@openscience.com",
            defaults=dict(full_name="Open Science Staff", role="employee", company=flagship),
        )
        if created:
            staff.set_password("demo1234")
            staff.save()

        # ---- Private enterprise tenants (data ISOLATION + COLLABORATION demo) ----
        # Company A / B / C are NOT on the public portal. Each gets an admin, an
        # HR persona (role "employee") and a read-only viewer, all password demo1234.
        ent_users = {}  # slug -> {"admin": u, "hr": u, "viewer": u}
        for slug, (name, docs) in ENTERPRISE.items():
            company, _ = Company.objects.get_or_create(slug=slug, defaults={"name": name})
            people = {}
            for key, role in (("admin", "admin"), ("hr", "employee"), ("viewer", "viewer")):
                user, created = User.objects.get_or_create(
                    email=f"{key}@{slug}.com",
                    defaults=dict(full_name=f"{name} {key.upper()}", role=role, company=company),
                )
                if created:
                    user.set_password("demo1234")
                    user.save()
                people[key] = user
            ent_users[slug] = people
            for (fname, category, days_ago, edesc, is_okf, body) in docs:
                # map the 6-tuple ENTERPRISE spec onto _doc's 8-tuple (private, 0 downloads)
                spec = (fname, category, 0, days_ago, edesc, False, is_okf, body)
                new_docs += 1 if self._doc(company, people["admin"], spec) else 0

        # ---- Cross-company collaboration demo (granular DocumentShare) ----
        # Company C shares ONE document with ONE named person at Company A —
        # an explicit, per-user exception to the default per-company isolation.
        try:
            vendor_doc = Document.objects.get(
                company__slug="company-c", filename="Vendor Security Requirements.md",
            )
            DocumentShare.objects.get_or_create(
                document=vendor_doc,
                shared_with_user=ent_users["company-a"]["hr"],
                defaults=dict(shared_by=ent_users["company-c"]["admin"], can_download=True),
            )
        except (Document.DoesNotExist, KeyError):
            pass

        self.stdout.write(self.style.SUCCESS(
            f">> Seeded {Company.objects.count()} companies, "
            f"{Document.objects.filter(is_public=True).count()} public docs "
            f"({new_docs} new) across "
            f"{Document.objects.filter(is_public=True).values('category').distinct().count()} genres."
        ))
        self.stdout.write(
            "   Public/enterprise publisher login: admin@openscience.com / demo1234\n"
            "   Private tenants (isolation demo): admin@company-a.com, hr@company-a.com,\n"
            "     viewer@company-a.com  (same for company-b / company-c) — all demo1234\n"
            "   Collaboration demo: Company C's 'Vendor Security Requirements.md' is\n"
            "     shared with hr@company-a.com only."
        )
        self.stdout.write("   (delete db.sqlite3 and re-run for a clean rebuild)")
