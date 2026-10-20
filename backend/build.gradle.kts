plugins { id("java"); id("org.springframework.boot"); id("io.spring.dependency-management") }
group = "com.barberworkshop"; version = "1.0.0"
java { toolchain { languageVersion = JavaLanguageVersion.of(17) } }
dependencies { implementation("org.springframework.boot:spring-boot-starter-web"); implementation("org.springframework.boot:spring-boot-starter-validation"); implementation("org.springframework.security:spring-security-crypto") }
