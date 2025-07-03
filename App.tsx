import React, { useState, useMemo } from 'react';
import { GoogleGenAI } from "@google/genai";
import { allSermons as initialSermons } from './data/sermons';
import { surahs } from './data/surahs';
import { Sermon, GeneratedSermonContent } from './types';
import { Sidebar } from './components/Sidebar';
import { SermonView } from './components/SermonView';
import { GenerateSermonModal } from './components/GenerateSermonModal';
import { useProgress } from './hooks/useProgress';
import { SearchIcon, BookOpenIcon, CheckCircleIcon, MenuIcon, PlusCircleIcon } from './components/icons';

const SermonCard: React.FC<{ sermon: Sermon; onSelect: (id: number) => void; isCompleted: boolean }> = ({ sermon, onSelect, isCompleted }) => (
    <div
        onClick={() => onSelect(sermon.id)}
        className="bg-white p-5 rounded-lg border border-gray-200 hover:border-teal-400 hover:shadow-md transition-all cursor-pointer group"
    >
        <div className="flex justify-between items-start">
            <div>
                <h3 className="text-xl font-bold text-gray-800 group-hover:text-teal-700">{sermon.title}</h3>
                <p className="text-sm text-gray-500 mt-1">{`سورة ${surahs.find(s => s.number === sermon.surahNumber)?.name || ''} - ${sermon.verses}`}</p>
            </div>
            {isCompleted && <CheckCircleIcon className="w-6 h-6 text-green-500 flex-shrink-0" />}
        </div>
    </div>
);


const App: React.FC = () => {
    const [sermons, setSermons] = useState<Sermon[]>(initialSermons);
    const [selectedSermonId, setSelectedSermonId] = useState<number | null>(null);
    const [selectedSurah, setSelectedSurah] = useState<number | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [isSidebarOpen, setSidebarOpen] = useState(false);
    
    const [isModalOpen, setModalOpen] = useState(false);
    const [isGenerating, setGenerating] = useState(false);
    const [generationError, setGenerationError] = useState<string | null>(null);

    const { progress, completedCount, toggleComplete, isCompleted } = useProgress(sermons.length);

    const filteredSermons = useMemo(() => {
        return sermons
            .filter(sermon => {
                if (selectedSurah && sermon.surahNumber !== selectedSurah) {
                    return false;
                }
                if (searchTerm) {
                    const lowerCaseSearch = searchTerm.toLowerCase();
                    const surahName = surahs.find(s => s.number === sermon.surahNumber)?.name.toLowerCase() || '';
                    return (
                        sermon.title.toLowerCase().includes(lowerCaseSearch) ||
                        sermon.verses.toLowerCase().includes(lowerCaseSearch) ||
                        sermon.khutbah1.tafsir.toLowerCase().includes(lowerCaseSearch) ||
                        sermon.khutbah2.hadith.text.toLowerCase().includes(lowerCaseSearch) ||
                        surahName.includes(lowerCaseSearch)
                    );
                }
                return true;
            });
    }, [selectedSurah, searchTerm, sermons]);

    const handleSelectSermon = (id: number) => {
        setSelectedSermonId(id);
        setSidebarOpen(false);
    };

    const handleBackToList = () => {
        setSelectedSermonId(null);
    };
    
    const handleSelectSurah = (surahNumber: number | null) => {
        setSelectedSurah(surahNumber);
        setSelectedSermonId(null); 
        setSidebarOpen(false);
    };

    const handleGenerateSermon = async (surahNumber: number, topic: string) => {
        setGenerating(true);
        setGenerationError(null);

        const surahName = surahs.find(s => s.number === surahNumber)?.name;

        const jsonStructure = `{"title": "string","verses": "string","khutbah1": {"title": "string","verses": "string","tafsir": "string","reflections": "string","messages": [{"message": "string", "explanation": "string"}],"repentance": "string"},"khutbah2": {"hadith": {"text": "string", "authenticity": "string"},"hadithReflection": "string","dua": "string"}}`;

        const systemInstruction = `أنت خبير في الشريعة الإسلامية وخطيب جمعة، متخصص في توليد محتوى عالي الجودة وموثوق.
مهمتك الأساسية هي الرد بصيغة JSON صالحة تمامًا وبشكل حصري. لا تضع أي نص قبل أو بعد كائن JSON.
التزم بالقواعد التالية بشكل صارم لا هوادة فيه:
1.  الرد الكامل يجب أن يكون كائن JSON واحد فقط.
2.  جميع أسماء الخصائص (keys) يجب أن تكون محاطة بعلامات اقتباس مزدوجة (e.g., "title"). لا تستخدم علامات اقتباس مفردة أو تتركها بدون اقتباسات. هذا شرط إلزامي.
3.  جميع القيم النصية (strings) يجب أن تكون محاطة بعلامات اقتباس مزدوجة.
4.  يجب تهريب (escape) أي علامات اقتباس مزدوجة (") داخل النصوص باستخدام شرطة مائلة عكسية (\\").
5.  لا تضف أي فواصل زائدة (trailing commas) في نهاية الكائنات أو المصفوفات.
6.  تأكد من أن الرد النهائي هو JSON صالح 100% يمكن تحليله مباشرة.`;

        const userPrompt = `مهمتك: قم بتوليد خطبة جمعة متكاملة، عميقة، ومفصلة (حوالي 3000 كلمة) باللغة العربية الفصحى، معتمدة على مصادر إسلامية موثوقة ومتفق عليها.
الموضوع: سورة "${surahName}".
${topic ? `التركيز الخاص: الآيات في "${topic}".` : 'التركيز العام: أهم مقاصد السورة.'}

التزم بالهيكل والمواصفات التالية بدقة شديدة عند توليد الرد بصيغة JSON:
- title (string): عنوان رئيسي جذاب للخطبة كلها.
- verses (string): مرجع للآيات المعتمدة (مثال: "البقرة: ١-٥").
- khutbah1:
  - title (string): عنوان للخطبة الأولى.
  - verses (string): النص الكامل للآيات القرآنية محور الخطبة، مع التشكيل.
  - tafsir (string): تفسير وشرح للآيات. يجب أن تذكر نص الآية ثم تتبعها بتفسيرها، معتمدًا على كتب التفسير الموثوقة.
  - reflections (string): تأملات إيمانية وعملية مستنبطة من الآيات. يجب أن يكون هذا القسم موسعًا جدًا وعميقًا (توسع بنسبة 300% عن المعتاد).
  - messages (array of objects): رسائل إيمانية عملية وواضحة. كل كائن في المصفوفة يجب أن يحتوي على:
    - message (string): رسالة موجزة.
    - explanation (string): شرح موسع لهذه الرسالة في 5 أسطر على الأقل، يوضح كيفية تطبيقها عمليًا.
  - repentance (string): دعوة قصيرة للتوبة والاستغفار في نهاية الخطبة الأولى.
- khutbah2:
  - hadith (object): حديث نبوي شريف مرتبط بموضوع الخطبة. الكائن يجب أن يحتوي على:
    - text (string): النص الكامل للحديث مع التشكيل.
    - authenticity (string): درجة صحة الحديث (مثال: "متفق عليه"، "صحيح البخاري"، "رواه مسلم").
  - hadithReflection (string): شرح وتأمل في الحديث وكيف يرتبط بالآيات وموضوع الخطبة.
  - dua (string): دعاء ختامي شامل ومؤثر.

اتبع هيكل الـ JSON التالي حرفيًا:
${jsonStructure}`;

        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            const response = await ai.models.generateContent({
                model: "gemini-2.5-flash-preview-04-17",
                contents: userPrompt,
                config: {
                    systemInstruction: systemInstruction,
                    responseMimeType: "application/json",
                },
            });
            
            let jsonStr = response.text.trim();
            const fenceRegex = /^```(\w*)?\s*\n?(.*?)\n?\s*```$/s;
            const match = jsonStr.match(fenceRegex);
            if (match && match[2]) {
                jsonStr = match[2].trim();
            }

            const generatedContent: GeneratedSermonContent = JSON.parse(jsonStr);

            const newSermon: Sermon = {
                id: sermons.length + 1,
                surahNumber: surahNumber,
                pageNumber: 0, // Generated sermons don't have a page number
                ...generatedContent
            };

            setSermons(prev => [...prev, newSermon]);
            setModalOpen(false);

        } catch (e) {
            console.error("Failed to generate sermon:", e);
            let errorMessage = "فشل توليد الخطبة. قد يكون هناك مشكلة في الشبكة أو في الرد من الخادم. يرجى المحاولة مرة أخرى.";
            if (e instanceof Error && e.message.includes('JSON')) {
                errorMessage = `فشل توليد الخطبة بسبب خطأ في تنسيق الرد من الخادم. نرجو المحاولة مرة أخرى. (تفاصيل الخطأ: ${e.message})`;
            }
            setGenerationError(errorMessage);
        } finally {
            setGenerating(false);
        }
    };


    const selectedSermon = sermons.find(s => s.id === selectedSermonId);
    const surahName = selectedSurah ? surahs.find(s => s.number === selectedSurah)?.name : 'كل الخطب';

    return (
        <div className="bg-gray-50 min-h-screen">
            <Sidebar
                surahs={surahs}
                selectedSurah={selectedSurah}
                onSelectSurah={handleSelectSurah}
                progress={progress}
                completedCount={completedCount}
                totalSermons={sermons.length}
                isOpen={isSidebarOpen}
            />

            <main className="md:ms-64 transition-all duration-300">
                <header className="sticky top-0 bg-white/80 backdrop-blur-lg border-b border-gray-200 z-30 p-4">
                    <div className="flex items-center justify-between">
                         <div className="flex items-center gap-4">
                            <button onClick={() => setSidebarOpen(!isSidebarOpen)} className="md:hidden text-gray-600">
                                <MenuIcon />
                            </button>
                            <h1 className="text-2xl font-bold text-teal-800 hidden sm:block">منبر الجمعة</h1>
                         </div>
                        <div className="relative flex-1 max-w-lg mx-4">
                            <input
                                type="text"
                                placeholder="ابحث بالآية أو الكلمة المفتاحية..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full px-4 py-2 pe-10 border border-gray-300 rounded-full focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition"
                            />
                            <div className="absolute inset-y-0 end-0 flex items-center pe-3 pointer-events-none">
                                <SearchIcon className="w-5 h-5 text-gray-400" />
                            </div>
                        </div>
                    </div>
                </header>

                <div className="p-4 md:p-6">
                    {selectedSermon ? (
                        <SermonView
                            sermon={selectedSermon}
                            onBack={handleBackToList}
                            isCompleted={isCompleted(selectedSermon.id)}
                            onToggleComplete={toggleComplete}
                            surahName={surahs.find(s => s.number === selectedSermon.surahNumber)?.name || ''}
                        />
                    ) : (
                        <div>
                            <div className="mb-6 p-4 bg-white rounded-lg border border-gray-200 flex flex-wrap justify-between items-center gap-4">
                               <div className="flex items-center gap-3">
                                    <BookOpenIcon className="w-6 h-6 text-teal-600"/>
                                    <div>
                                        <h2 className="text-2xl font-bold text-gray-800">
                                            {`عرض خطب: ${surahName}`}
                                        </h2>
                                        <p className="text-gray-600">{`${filteredSermons.length} خطبة متاحة`}</p>
                                    </div>
                               </div>
                               <button 
                                onClick={() => {
                                    setGenerationError(null);
                                    setModalOpen(true);
                                }} 
                                className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg font-semibold hover:bg-teal-700 transition-colors">
                                    <PlusCircleIcon className="w-5 h-5"/>
                                    <span>توليد خطبة جديدة</span>
                                </button>
                            </div>
                            <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-4">
                                {filteredSermons.map(sermon => (
                                    <SermonCard
                                        key={sermon.id}
                                        sermon={sermon}
                                        onSelect={handleSelectSermon}
                                        isCompleted={isCompleted(sermon.id)}
                                    />
                                ))}
                            </div>
                             {filteredSermons.length === 0 && (
                                <div className="text-center py-16 text-gray-500">
                                    <p className="text-xl">لم يتم العثور على نتائج.</p>
                                    <p>حاول تغيير فلتر السورة أو مصطلح البحث.</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </main>
             {isSidebarOpen && (
                <div 
                    onClick={() => setSidebarOpen(false)} 
                    className="fixed inset-0 bg-black/50 z-30 md:hidden"
                ></div>
            )}
            <GenerateSermonModal 
                isOpen={isModalOpen}
                onClose={() => setModalOpen(false)}
                onGenerate={handleGenerateSermon}
                surahs={surahs}
                isGenerating={isGenerating}
                error={generationError}
            />
        </div>
    );
};

export default App;